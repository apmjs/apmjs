'use strict'
const crypto = require('crypto')
const IntegrityError = require('./error.js').IntegrityError
const ssri = require('ssri')

function checkSRI (dataStream, sum) {
  return ssri.checkStream(dataStream, sum).catch(e => {
    throw e.code === 'EINTEGRITY' ? new IntegrityError(e.message) : e
  })
}

function checkSHA1 (dataStream, sum) {
  let hash = crypto.createHash('sha1')
  dataStream.on('data', data => hash.update(data))

  return new Promise((resolve, reject) => dataStream.on('end', () => {
    let shasum = hash.digest('hex')
    if (shasum === sum) {
      return resolve(shasum)
    }
    let msg = `integrity checksum failed when using sha1: wanted ${sum} but got ${shasum}`
    reject(new IntegrityError(msg))
  }))
}

module.exports = {checkSRI, checkSHA1}
