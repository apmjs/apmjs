const debug = require('debug')('apmjs:commands:link')
const linker = require('../linker.js')

module.exports = function (argv, errorHandler) {
  unlink.apply(null, argv)
  .then(() => errorHandler())
  .catch(err => errorHandler(err))
}

function unlink (name) {
  return arguments.length === 0
    ? linker.unlinkCurrent()
    : linker.unlinkDependency(name)
}
