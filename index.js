module.exports = {
    parse: DecompressXML,
}

const TAG_OPEN = 0x10;
const TAG_SUPPORTS_CHILDREN = 0x100000;
const TAG_TEXT = 0x08;

// type Tag struct {
//     name     string
//     flags    uint32
//     attrs    []map[string]string
//     children []*Tag
// }

function DecompressXML(br) {
    const MAGIC_NUMBER = 0x80003;
    const CHUNK_TYPE_STRING = 0x1c0001;
    const CHUNK_TYPE_RESOURCE_ID = 0x80180;
    const CHUNK_TYPE_START_NAMESPACE = 0x100100;
    const CHUNK_TYPE_END_NAMESPACE = 0x100101;
    const CHUNK_TYPE_START_TAG = 0x100102;
    const CHUNK_TYPE_END_TAG = 0x100103;
    const CHUNK_TYPE_TEXT = 0x100104;

    let pos = 0; // file position
    // Some header, seems to be 3000 8000 always.
    let v;

    const magicNumber = br.readUInt32LE(0);
    if (magicNumber !== MAGIC_NUMBER) {
        throw new Error('Magic number is invalid: 0x' + magicNumber.toString(16) +
            ' != 0x' + MAGIC_NUMBER.toString(16))
    }

    // Total file length.
    const fileSize = br.readUInt32LE(4);
    
    // String tag magic, always 0100 1c00
    const stringTagMagicNumber = br.readUInt32LE(8);
    if (stringTagMagicNumber !== CHUNK_TYPE_STRING) {
        throw new Error('String tag Magic number is invalid: 0x' + stringTagMagicNumber.toString(16) +
            ' != 0x' + CHUNK_TYPE_STRING.toString(16))
    }
    
    // Seems to be related to the total length of the string table.
    let stringChunkSize = br.readUInt32LE(0xc);
    
    // Number of items in the string table, plus some header non-sense?
    let stringsCnt = br.readUInt32LE(0x10);

    // Seems to always be 0.
    let stylesCnt = br.readUInt32LE(0x14);

    // Seems to always be 1.
    let reserveField = br.readUInt32LE(0x18);

    // No clue, relates to the size of the string table?
    let stringsOffset = br.readUInt32LE(0x1C);

    // Seems to always be 0.
    let stylesOffset = br.readUInt32LE(0x20);

    pos += 9 * 4

    // Offset in string table of each string.
    let stroffs = []
    for (let i = 0; i < stringsCnt; i++) {
        v = br.readUInt32LE(pos)
        pos += 4;
        stroffs.push(v);
    }

    const strs = [];

    let curroffs = 0;
    // the string table looks to have been serialized from a hash table, since
    // the positions are not sorted :)
    stroffs = stroffs.sort(function (a, b) {
        return a - b;
    });
    stroffs.forEach(function (offs) {
        if (offs !== curroffs) {
            throw new Error("Invaild string offset=0x" + offs.toString(16))
        }

        // var l, length uint16
        const l = br.readUInt16LE(pos + curroffs);
        curroffs += 2;

        const buf = br.slice(pos + curroffs, pos + curroffs + l*2);
        strs[offs] = utf16BytesToString(buf);
        curroffs += (l+1)*2;
    });

    pos += curroffs;
    const strings = [];
    let idx = 0;
    strs.forEach(function (v, offs) {
        strings[idx] = strs[offs];
        idx++;
    });

    // Looks like the string table is word-aligned.
    pos += pos % 4;

    return readMeat(br.slice(pos), strings);
}

function printTree(node, depth) {
    const buff = [];
    for (let i = 0; i < depth; i++) {
        buff.push("\t");
    }
    if (node.flags & TAG_TEXT !== 0) {
        buff.push(node.name);
        return buff.String();
    }
    buff.push("<")
    if (node.flags & TAG_OPEN === 0) {
        buff.push("/");
    }
    buff.push(node.name);
    node.attrs.forEach(function (attr) {
        buff.push(" ");
        if (attr["ns"]) {
            buff.push(attr["ns"] + ":");
        }
        buff.push(attr["name"] + "=\"" + attr["value"] + "\"")
    });
    if (!node.children.length) {
        buff.push(" /");
    }
    buff.push(">\n");
    if (node.children.length > 0) {
        node.children.forEach(function (child) {
            buff.push(printTree(child, depth + 1))
        });
        for (let i = 0; i < depth; i++) {
            buff.push("\t");
        }
        buff.push("</" + node.name + ">\n");
    }
    return buff.join('')
}

function readMeat(br, strings) {
    const nsmap = new Map()
    const root = {};
    readTag(br, strings, nsmap, root);
    root.children = readChildren(br, strings, nsmap, root.name);
    return printTree(root, 0);
}

function readChildren(br, strings, nsmap, stoptag) {
    const children = []
    while (true) {
        const tag = {}
        readTag(br, strings, nsmap, tag);
        if (tag.flags & TAG_SUPPORTS_CHILDREN) {
            if (tag.flags & TAG_OPEN) {
                tag.children = readChildren(br, strings, nsmap, tag.name);
            } else if (tag.name === stoptag) {
                break;
            }
        }
        children.push(tag);
    }
    return children;
}

function readTag(br, strings, nsmap, tag) {
    const xmlns = new Map();
    const slen = strings.length;
    var unknown uint32
    // Hack to support the strange xmlns attribute encoding without disrupting our
    // processor.
    READ_AGAIN:
        var name, flags uint32
    if err := binary.Read(br, binary.LittleEndian, &name); err != nil {
        return err
    }
    if err := binary.Read(br, binary.LittleEndian, &flags); err != nil {
        return err
    }
    // Strange way to specify xmlns attribute.
    if int(name) < slen && int(flags) < slen {
        ns := strings[name]
        url := strings[flags]

        // TODO: How do we expect this?
        const ns_matched = /(?i)^[a-z]+$/.test(ns)
        const url_matched = /^http:\/\//.test(url)
        if (ns_matched && url_matched) {
            nsmap[flags] = name
            xmlns = append(xmlns, map[string]string{
                "name":  fmt.Sprintf("xmlns:%s", ns),
                    "value": url,
            })
            readPastSentinel(br, 0)
            goto READ_AGAIN
        }
    }
    if (flags&TAG_SUPPORTS_CHILDREN) != 0 && (flags&TAG_OPEN) != 0 {
        var attrs, ns uint32
        var attr, value, attrflags uint32
        if err := binary.Read(br, binary.LittleEndian, &attrs); err != nil {
            return err
        }
        if err := binary.Read(br, binary.LittleEndian, &unknown); err != nil {
            return err
        }

        for ; attrs > 0; attrs-- {
            if err := binary.Read(br, binary.LittleEndian, &ns); err != nil {
                return err
            }
            if err := binary.Read(br, binary.LittleEndian, &attr); err != nil {
                return err
            }
            // TODO: Escaping?
            if err := binary.Read(br, binary.LittleEndian, &value); err != nil {
                return err
            }
            if err := binary.Read(br, binary.LittleEndian, &attrflags); err != nil {
                return err
            }
            if value == 0xffffffff { // -1, last index of array
                value = uint32(slen) - 1
            }
            var attr_map = map[string]string{
                "name":  strings[attr],
                    "value": strings[value],
                // "flag": strconv.Itoa(int(attrflags)),
            }
            if ns != 0xffffffff {
                attr_map["ns"] = strings[nsmap[ns]]
            }

            xmlns = append(xmlns, attr_map)
            // padding
            if err := binary.Read(br, binary.LittleEndian, &unknown); err != nil {
                return err
            }
            // readPastSentinel(br, 1);
        }

        readPastSentinel(br, 0)
    } else {
        // There is strong evidence here that what I originally thought
        // to be a sentinel is not ;)
        if err := binary.Read(br, binary.LittleEndian, &unknown); err != nil {
            return err
        }
        if err := binary.Read(br, binary.LittleEndian, &unknown); err != nil {
            return err
        }

        readPastSentinel(br, 0)
    }

    tag.name = strings[name];
    tag.flags = flags;
    tag.attrs = xmlns;
}


function utf16BytesToString(binaryStr) {
    const cp = [];
    for(let i = 0; i < binaryStr.length; i += 2) {
        cp.push(
            binaryStr[i] |
            ( binaryStr[i+1] << 8 )
        );
    }

    return String.fromCharCode.apply( String, cp );
}