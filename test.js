const fs = require('fs');
const Axml2Xml = require('./index');

const buf = fs.readFileSync('./tests/AndroidManifest2.xml');
console.log(Axml2Xml.convert(buf));