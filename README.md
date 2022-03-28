# axml2xml

A library for decoding/convert .axml to .xml in JavaScript.

Reference: [https://github.com/xgouchet/AXML]()

## Usage

### convert(buf)

Convert .axml to .xml file.

```js
const Axml2Xml = require('axml2xml');
const buf = fs.readFileSync('./tests/AndroidManifest.xml');
console.log(Axml2Xml.convert(buf));
```

### parse(buf)

Parse .axml file to a tree.

```js
const Axml2Xml = require('axml2xml');
const buf = fs.readFileSync('./tests/AndroidManifest.xml');
console.log(Axml2Xml.parse(buf));
```

### analyse(buf, mListener)

Analyse .axml file. You need to set some listeners for analysing.

```js
const Axml2Xml = require('axml2xml');
const buf = fs.readFileSync('./tests/AndroidManifest.xml');
analyse(buf, {
    /**
     * Receive notification of the beginning of a document.
     */
    startDocument: function () {
        console.log('startDocument')
    },

    /**
     * Receive notification of the end of a document.
     */
    endDocument: function () {
        console.log('endDocument')
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
        console.log('startPrefixMapping:', prefix, uri);
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
        console.log('endPrefixMapping:', prefix, uri);
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
        console.log('startElement:', uri, localName, qName, atts);
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
        console.log('endElement:', uri, localName, qName);
    },
});
```

## LICENCE

Copyright (C) 2022 by Micblo (https://micblo.com) MIT Licence / Expat

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS ( XAVIER GOUCHET ) BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
