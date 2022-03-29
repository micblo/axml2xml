export interface Node {
    uri: string;
    localName: string;
    qName: string;
    prefixes: string[][],
    attrs: Attribution[],
    children: Node[],
}

export interface Attribution {
    name: string;
    namespace: string;
    prefix: string;
    value: string;
}

export interface Buffer {
    length: number
    readUInt32LE(offset: number, noAssert?: boolean): number;
    readUInt16LE(offset: number, noAssert?: boolean): number;
}

export interface Listeners {
    /**
     * Receive notification of the beginning of a document.
     */
    startDocument();

    /**
     * Receive notification of the end of a document.
     */
    endDocument();

    /**
     * Begin the scope of a prefix-URI Namespace mapping.
     *
     * @param prefix
     *            the Namespace prefix being declared. An empty string is used
     *            for the default element namespace, which has no prefix.
     * @param uri
     *            the Namespace URI the prefix is mapped to
     */
    startPrefixMapping(prefix: string, uri: string);

    /**
     * End the scope of a prefix-URI mapping.
     *
     * @param prefix
     *            the prefix that was being mapped. This is the empty string
     *            when a default mapping scope ends.
     * @param uri
     *            the Namespace URI the prefix is mapped to
     */
    endPrefixMapping(prefix: string, uri: string);


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
    startElement(uri: string, localName: string, qName: string, atts: Attribution[]);

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
    endElement(uri: string, localName: string, qName: string);
}

interface Axml2xml {

    /**
     * Analyse .axml file
     * @param buf Buffer of .axml file
     * @param mListener listeners when analysing
     */
    analyse(buf: Buffer, mListener: Listeners);

    /**
     * Parse .axml file to a tree
     * @param buf Buffer of .axml file
     * @returns {Node}
     */
    parse(buf: Buffer) : Node;

    /**
     * Convert .axml to .xml file
     * @param buf Buffer of .axml file
     * @returns {string} String of .xml file
     */
    convert(buf: Buffer) : string;
}

export var Axml2xml : Axml2xml
