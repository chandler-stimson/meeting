'use strict';

const safe = {};
window.safe = safe;

{
  const iv = crypto.getRandomValues(new Uint8Array(16));

  const toBuffer = str => {
    const bytes = new Uint8Array(str.length);
    [...str].forEach((c, i) => bytes[i] = c.charCodeAt(0));
    return bytes;
  };
  const toString = buffer => [...buffer].map(b => String.fromCharCode(b)).join('');

  let key = '';
  safe.password = async password => {
    key = await crypto.subtle.digest({
      name: 'SHA-256'
    }, toBuffer(password)).then(result => crypto.subtle.importKey('raw', result, {
      name: 'AES-CBC'
    }, false, ['encrypt', 'decrypt']));
  };
  safe.encrypt = async data => {
    const result = await crypto.subtle.encrypt({
      name: 'AES-CBC',
      iv
    }, key, toBuffer(data));
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(new Blob([iv, result], {type: 'application/octet-binary'}));
    });
  };
  safe.decrypt = async data => {
    const result = await crypto.subtle.decrypt({
      name: 'AES-CBC',
      iv
    }, key, toBuffer(atob(data.split(',')[1])));
    return toString((new Uint8Array(result)).subarray(16));
  };
}
