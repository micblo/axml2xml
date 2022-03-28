const fs = require('fs');
const Axml2Xml = require('./index');

Axml2Xml.parse(fs.readFileSync('./tests/AndroidManifest.xml'))
