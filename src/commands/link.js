const debug = require('debug')('apmjs:commands:link')
const linker = require('../linker.js')

module.exports = function (argv, errorHandler) {
  link.apply(null, argv)
  .then(() => errorHandler())
  .catch(err => errorHandler(err))
}

function link (name) {
  return arguments.length === 0
    ? linker.linkToGlobal()
    : linker.linkFromGlobal(name)
}
