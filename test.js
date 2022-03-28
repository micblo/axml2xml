const fs = require('fs');
const Axml2Xml = require('./index');

const buf = fs.readFileSync('./tests/AndroidManifest.xml');
console.log(Axml2Xml.convert(buf));