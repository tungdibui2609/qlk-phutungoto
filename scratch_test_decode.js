const { decodeSTT } = require('./src/lib/numberUtils');
console.log('Result for 100001:', decodeSTT(100001));
console.log('Result for "100001":', decodeSTT("100001"));
