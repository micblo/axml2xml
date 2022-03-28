const sprintf = require('sprintf-js').sprintf;

const WORD_START_DOCUMENT = 0x00080003;

const WORD_STRING_TABLE = 0x001C0001;
const WORD_RES_TABLE = 0x00080180;

const WORD_START_NS = 0x00100100;
const WORD_END_NS = 0x00100101;
const WORD_START_TAG = 0x00100102;
const WORD_END_TAG = 0x00100103;
const WORD_TEXT = 0x00100104;
const WORD_EOS = 0xFFFFFFFF;
const WORD_SIZE = 4;

const TYPE_ID_REF = 0x01000008;
const TYPE_ATTR_REF = 0x02000008;
const TYPE_STRING = 0x03000008;
const TYPE_DIMEN = 0x05000008;
const TYPE_FRACTION = 0x06000008;
const TYPE_INT = 0x10000008;
const TYPE_FLOAT = 0x04000008;

const TYPE_FLAGS = 0x11000008;
const TYPE_BOOL = 0x12000008;
const TYPE_COLOR = 0x1C000008;
const TYPE_COLOR2 = 0x1D000008;

const DIMEN = ["px", "dp", "sp", "pt", "in", "mm"];

/**
 * Analyse .axml file
 * @param buf Buffer of .axml file
 * @param mListener listeners when analysing
 */
function analyse(buf, mListener) {
    mListener = mListener || {};

    // Global variables
    let mStringsCount;
    let mStylesCount;
    let mStringsTable;

    let mResCount;
    let mResourcesIds;

    const mNamespaces = new Map();

    // Global variables END

    let mParserOffset = 0;
    while (mParserOffset < buf.length) {
        const word0 = buf.readUInt32LE(mParserOffset);
        switch (word0) {
            case WORD_START_DOCUMENT:
                parseStartDocument();
                break;
            case WORD_STRING_TABLE:
                parseStringTable();
                break;
            case WORD_RES_TABLE:
                parseResourceTable();
                break;
            case WORD_START_NS:
                parseNamespace(true);
                break;
            case WORD_END_NS:
                parseNamespace(false);
                break;
            case WORD_START_TAG:
                parseStartTag();
                break;
            case WORD_END_TAG:
                parseEndTag();
                break;
            case WORD_TEXT:
                parseText();
                break;
            case WORD_EOS:
                if (mListener['endDocument']) {
                    mListener['endDocument']();
                }
                break;
            default:
                mParserOffset += WORD_SIZE;
                break;
        }
    }

    if (mListener['endDocument']) {
        mListener['endDocument']();
    }

    // main End

    /**
     * A doc starts with the following 4bytes words :
     * <ul>
     * <li>0th word : 0x00080003</li>
     * <li>1st word : chunk size</li>
     * </ul>
     */
    function parseStartDocument() {
        if (mListener['startDocument']) {
            mListener['startDocument']();
        }
        mParserOffset += (2 * WORD_SIZE);
    }

    /**
     * the string table starts with the following 4bytes words :
     * <ul>
     * <li>0th word : 0x1c0001</li>
     * <li>1st word : chunk size</li>
     * <li>2nd word : number of string in the string table</li>
     * <li>3rd word : number of styles in the string table</li>
     * <li>4th word : flags - sorted/utf8 flag (0)</li>
     * <li>5th word : Offset to String data</li>
     * <li>6th word : Offset to style data</li>
     * </ul>
     */
    function parseStringTable() {
        const chunk = buf.readUInt32LE(mParserOffset + (WORD_SIZE));
        mStringsCount = buf.readUInt32LE(mParserOffset + (2 * WORD_SIZE));
        mStylesCount = buf.readUInt32LE(mParserOffset + (3 * WORD_SIZE));
        const strOffset = mParserOffset
            + buf.readUInt32LE(mParserOffset + (5 * WORD_SIZE));
        const styleOffset = buf.readUInt32LE(mParserOffset + (6 * WORD_SIZE));

        mStringsTable = [];
        for (let i = 0; i < mStringsCount; ++i) {
            const offset = strOffset
                + buf.readUInt32LE(mParserOffset + ((i + 7) * WORD_SIZE));
            mStringsTable[i] = getStringFromStringTable(offset);
        }

        if (styleOffset > 0) {
            for (let i = 0; i < mStylesCount; ++i) {
                // TODO read the styles ???
            }
        }

        mParserOffset += chunk;
    }

    /**
     * the resource ids table starts with the following 4bytes words :
     * <ul>
     * <li>0th word : 0x00080180</li>
     * <li>1st word : chunk size</li>
     * </ul>
     */
    function parseResourceTable() {
        const chunk = buf.readUInt32LE(mParserOffset + (WORD_SIZE));
        mResCount = (chunk / 4) - 2;

        mResourcesIds = [];
        for (let i = 0; i < mResCount; ++i) {
            mResourcesIds[i] = buf.readUInt32LE(mParserOffset + ((i + 2) * WORD_SIZE));
        }

        mParserOffset += chunk;
    }

    /**
     * A namespace tag contains the following 4bytes words :
     * <ul>
     * <li>0th word : 0x00100100 = Start NS / 0x00100101 = end NS</li>
     * <li>1st word : chunk size</li>
     * <li>2nd word : line this tag appeared</li>
     * <li>3rd word : optional xml comment for element (usually 0xFFFFFF)</li>
     * <li>4th word : index of namespace prefix in StringIndexTable</li>
     * <li>5th word : index of namespace uri in StringIndexTable</li>
     * </ul>
     */
    function parseNamespace(start) {
        const prefixIdx = buf.readUInt32LE(mParserOffset + (4 * WORD_SIZE));
        const uriIdx = buf.readUInt32LE(mParserOffset + (5 * WORD_SIZE));

        const uri = getString(uriIdx);
        const prefix = getString(prefixIdx);

        if (start) {
            if (mListener['startPrefixMapping']) {
                mListener['startPrefixMapping'](prefix, uri);
            }
            mNamespaces.set(uri, prefix);
        } else {
            if (mListener['endPrefixMapping']) {
                mListener['endPrefixMapping'](prefix, uri);
            }
            mNamespaces.delete(uri);
        }

        // Offset to first tag
        mParserOffset += (6 * WORD_SIZE);
    }

    /**
     * A start tag will start with the following 4bytes words :
     * <ul>
     * <li>0th word : 0x00100102 = Start_Tag</li>
     * <li>1st word : chunk size</li>
     * <li>2nd word : line this tag appeared in the original file</li>
     * <li>3rd word : optional xml comment for element (usually 0xFFFFFF)</li>
     * <li>4th word : index of namespace uri in StringIndexTable, or 0xFFFFFFFF
     * for default NS</li>
     * <li>5th word : index of element name in StringIndexTable</li>
     * <li>6th word : size of attribute structures to follow</li>
     * <li>7th word : number of attributes following the start tag</li>
     * <li>8th word : index of id attribute (0 if none)</li>
     * </ul>
     */
    function parseStartTag() {
        // get tag info
        const uriIdx = buf.readUInt32LE(mParserOffset + (4 * WORD_SIZE));
        const nameIdx = buf.readUInt32LE(mParserOffset + (5 * WORD_SIZE));
        const attrCount = buf.readUInt16LE(mParserOffset + (7 * WORD_SIZE));

        const name = getString(nameIdx);
        let uri, qname;
        if (uriIdx === 0xFFFFFFFF) {
            uri = "";
            qname = name;
        } else {
            uri = getString(uriIdx);
            if (mNamespaces.has(uri)) {
                qname = mNamespaces.get(uri) + ':' + name;
            } else {
                qname = name;
            }
        }

        // offset to start of attributes
        mParserOffset += (9 * WORD_SIZE);

        const attrs = []; // NOPMD
        for (let a = 0; a < attrCount; a++) {
            attrs[a] = parseAttribute(); // NOPMD

            // offset to next attribute or tag
            mParserOffset += (5 * 4);
        }

        if (mListener['startElement']) {
            mListener['startElement'](uri, name, qname, attrs);
        }
    }

    /**
     * An attribute will have the following 4bytes words :
     * <ul>
     * <li>0th word : index of namespace uri in StringIndexTable, or 0xFFFFFFFF
     * for default NS</li>
     * <li>1st word : index of attribute name in StringIndexTable</li>
     * <li>2nd word : index of attribute value, or 0xFFFFFFFF if value is a
     * typed value</li>
     * <li>3rd word : value type</li>
     * <li>4th word : resource id value</li>
     * </ul>
     */
    function parseAttribute() {
        const attrNSIdx = buf.readUInt32LE(mParserOffset);
        const attrNameIdx = buf.readUInt32LE(mParserOffset + (WORD_SIZE));
        const attrValueIdx = buf.readUInt32LE(mParserOffset + (2 * WORD_SIZE));
        const attrType = buf.readUInt32LE(mParserOffset + (3 * WORD_SIZE));
        const attrData = buf.readUInt32LE(mParserOffset + (4 * WORD_SIZE));

        const attr = {
            name: getString(attrNameIdx),
        };

        if (attrNSIdx === 0xFFFFFFFF) {
            attr['namespace'] = null;
            attr['prefix'] = null;
        } else {
            const uri = getString(attrNSIdx);
            if (mNamespaces.has(uri)) {
                attr['namespace'] = uri;
                attr['prefix'] = mNamespaces.get(uri);
            }
        }

        if (attrValueIdx === 0xFFFFFFFF) {
            attr['value'] = getAttributeValue(attrType, attrData);
        } else {
            attr['value'] = getString(attrValueIdx);
        }

        return attr;

    }

    /**
     * A text will start with the following 4bytes word :
     * <ul>
     * <li>0th word : 0x00100104 = Text</li>
     * <li>1st word : chunk size</li>
     * <li>2nd word : line this element appeared in the original document</li>
     * <li>3rd word : optional xml comment for element (usually 0xFFFFFF)</li>
     * <li>4rd word : string index in string table</li>
     * <li>5rd word : ??? (always 8)</li>
     * <li>6rd word : ??? (always 0)</li>
     * </ul>
     */
    function parseText() {
        // get tag infos
        const strIndex = buf.readUInt32LE(mParserOffset + (4 * WORD_SIZE));

        const data = getString(strIndex);
        mListener.characterData(data);

        // offset to next node
        mParserOffset += (7 * WORD_SIZE);
    }

    /**
     * EndTag contains the following 4bytes words :
     * <ul>
     * <li>0th word : 0x00100103 = End_Tag</li>
     * <li>1st word : chunk size</li>
     * <li>2nd word : line this tag appeared in the original file</li>
     * <li>3rd word : optional xml comment for element (usually 0xFFFFFF)</li>
     * <li>4th word : index of namespace name in StringIndexTable, or 0xFFFFFFFF
     * for default NS</li>
     * <li>5th word : index of element name in StringIndexTable</li>
     * </ul>
     */
    function parseEndTag() {
        // get tag info
        const uriIdx = buf.readUInt32LE(mParserOffset + (4 * WORD_SIZE));
        const nameIdx = buf.readUInt32LE(mParserOffset + (5 * WORD_SIZE));

        const name = getString(nameIdx);
        let uri;
        if (uriIdx === 0xFFFFFFFF) {
            uri = "";
        } else {
            uri = getString(uriIdx);
        }

        if (mListener['endElement']) {
            mListener['endElement'](uri, name, null);
        }

        // offset to start of next tag
        mParserOffset += (6 * WORD_SIZE);
    }

    /**
     * @param index the index of the string in the StringIndexTable
     * @return the string
     */
    function getString(index) {
        if ((index >= 0) && (index < mStringsCount)) {
            return mStringsTable[index];
        } else {
            return null; // NOPMD
        }
    }

    /**
     * @param offset offset of the beginning of the string inside the StringTable
     *               (and not the whole data array)
     * @return the String
     */
    function getStringFromStringTable(offset) {
        const l = buf.readUInt16LE(offset);
        offset += 2;

        return utf16BytesToString(buf.slice(offset, offset + l*2));
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

    /**
     * @param type the attribute type
     * @param data the data value
     * @return the typed value
     */
    function getAttributeValue(type, data) {
        switch (type) {
            case TYPE_STRING:
                return getString(data);
            case TYPE_DIMEN:
                return (data >> 8) + DIMEN[data & 0xFF];
            case TYPE_FRACTION:
                const fracValue = data / 0x7FFFFFFF;
                return sprintf("%.2f", fracValue);
            // return new DecimalFormat("#.##%").format(fracValue);
            case TYPE_FLOAT:
                const buf = new ArrayBuffer(4);
                (new Float32Array(buf))[0] = data;
                return (new Uint32Array(buf))[0];
            case TYPE_INT:
            case TYPE_FLAGS:
                return data;
            case TYPE_BOOL:
                return data !== 0;
            case TYPE_COLOR:
            case TYPE_COLOR2:
                return sprintf("#%08X", data);
            case TYPE_ID_REF:
                return sprintf("@id/0x%08X", data);
            case TYPE_ATTR_REF:
                return sprintf("?id/0x%08X", data);
            default:
                return sprintf("%08X/0x%08X", type, data);
        }
    }
}

/**
 * Parse .axml file to a tree
 * @param buf Buffer of .axml file
 * @returns {*}
 */
function parse(buf) {
    const root = {
        uri: '',
        localName: '',
        qName: '',
        prefixes: [],
        attrs: [],
        children: [],
    };
    const nodes = [root];
    const prefixes = [[]];

    function getLatestNode() {
        return nodes[nodes.length - 1];
    }

    analyse(buf, {
        /**
         * Receive notification of the beginning of a document.
         */
        startDocument: function () {
            // console.log('startDocument')
        },

        /**
         * Receive notification of the end of a document.
         */
        endDocument: function () {
            // console.log('endDocument')
        },

        /**
         * Begin the scope of a prefix-URI Namespace mapping.
         *
         * @param prefix
         *            the Namespace prefix being declared. An empty string is used
         *            for the default element namespace, which has no prefix.
         * @param uri
         *            the Namespace URI the prefix is mapped to
         */
        startPrefixMapping: function (prefix, uri) {
            // console.log('startPrefixMapping:', prefix, uri);
            prefixes[prefixes.length - 1].push([prefix, uri]);
        },

        /**
         * End the scope of a prefix-URI mapping.
         *
         * @param prefix
         *            the prefix that was being mapped. This is the empty string
         *            when a default mapping scope ends.
         * @param uri
         *            the Namespace URI the prefix is mapped to
         */
        endPrefixMapping: function (prefix, uri) {
            // console.log('endPrefixMapping:', prefix, uri);
            prefixes[prefixes.length - 1].pop();
        },


        /**
         * Receive notification of the beginning of an element.
         *
         * @param uri
         *            the Namespace URI, or the empty string if the element has no
         *            Namespace URI or if Namespace processing is not being
         *            performed
         * @param localName
         *            the local name (without prefix), or the empty string if
         *            Namespace processing is not being performed
         * @param qName
         *            the qualified name (with prefix), or the empty string if
         *            qualified names are not available
         * @param atts
         *            the attributes attached to the element. If there are no
         *            attributes, it shall be an empty Attributes object. The value
         *            of this object after startElement returns is undefined
         */
        startElement: function (uri, localName, qName, atts) {
            // console.log('startElement:', uri, localName, qName, atts);
            const node = {
                uri: uri,
                localName: localName,
                qName: qName,
                prefixes: [],
                attrs: atts,
                children: []
            };
            getLatestNode().children.push(node);
            nodes.push(node);
            prefixes.push([]);
        },

        /**
         * Receive notification of the end of an element.
         *
         * @param uri
         *            the Namespace URI, or the empty string if the element has no
         *            Namespace URI or if Namespace processing is not being
         *            performed
         * @param localName
         *            the local name (without prefix), or the empty string if
         *            Namespace processing is not being performed
         * @param qName
         *            the qualified XML name (with prefix), or the empty string if
         *            qualified names are not available
         */
        endElement: function (uri, localName, qName) {
            // console.log('endElement:', uri, localName, qName);
            const node = nodes.pop();
            prefixes.pop();
            node.prefixes = prefixes[prefixes.length - 1].slice(0);
        },
    });

    return root.children[0];
}

/**
 * Convert .axml to .xml file
 * @param buf Buffer of .axml file
 * @returns {string} String of .xml file
 */
function convert(buf) {
    const tree = parse(buf);
    const xml = [];
    xml.push('<?xml version="1.0" encoding="utf-8"?>\n')
    xml.push(printTree(tree, 0));

    function printTree(node, depth) {
        const buff = [];
        for (let i = 0; i < depth; i++) {
            buff.push("\t");
        }

        buff.push("<", node.qName);

        node.prefixes.forEach(function (prefix) {
            buff.push(" xmlns:");
            buff.push(prefix[0] + '="' + prefix[1] + '"')
        });

        node.attrs.forEach(function (attr) {
            buff.push(" ");
            if (attr["prefix"]) {
                buff.push(attr["prefix"] + ":");
            }
            buff.push(attr["name"] + '="' + attr["value"] + '"')
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
            buff.push("</" + node.qName + ">\n");
        }
        return buff.join('')
    }

    return xml.join('');
}

module.exports = {
    analyse: analyse,
    parse: parse,
    convert: convert,
}
