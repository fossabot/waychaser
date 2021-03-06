import logger from '../../util/logger'
import { WaychaserProxy } from './waychaser-proxy'

class WaychaserViaWebdriver extends WaychaserProxy {
  constructor (manager) {
    super()
    this.manager = manager
  }

  async load (url) {
    logger.debug(`loading ${url}`)
    const rval = await this.manager.executeAsyncScript(
      /* istanbul ignore next: won't work in browser otherwise */
      function (url, done) {
        window.testLogger(`loading ${url}`)
        window.testWaychaser
          .load(url)
          .then(function (resource) {
            window.testLogger('success')
            window.testResults.push(resource)
            window.testLogger('calling back')
            done({ success: true, id: window.testResults.length - 1 })
          })
          .catch(error => {
            window.callbackWithError(done, error)
          })
      },
      url
    )
    logger.debug({ rval })
    // await this.manager.executeScript(
    //   /* istanbul ignore next: won't work in browser otherwise */
    //   function () {
    //     window.testLogger('after')
    //   }
    // )
    return rval
  }

  async getOCount (property, result) {
    return this.manager.executeAsyncScript(
      /* istanbul ignore next: won't work in browser otherwise */
      function (id, property, done) {
        done(window.testResults[id][property].count())
      },
      result.id,
      property
    )
  }

  async findOne (result, relationship) {
    return this.manager.executeAsyncScript(
      /* istanbul ignore next: won't work in browser otherwise */
      function (id, relationship, done) {
        done({
          foundOperation: window.testResults[id].operations.findOne(
            relationship
          ),
          foundOperationLokiStyle: window.testResults[id].operations.findOne({
            rel: relationship
          }),
          foundOp: window.testResults[id].ops.findOne(relationship),
          foundOpLokiStyle: window.testResults[id].ops.findOne({
            rel: relationship
          })
        })
      },
      result.id,
      relationship
    )
  }

  async invokeO (property, result, relationship, context) {
    return this.manager.executeAsyncScript(
      /* istanbul ignore next: won't work in browser otherwise */
      function (id, relationship, property, context, done) {
        window.testLogger('invokeOperation')
        window.testLogger(JSON.stringify(arguments, undefined, 2))
        const ops = window.testResults[id][property]
        window.testLogger(JSON.stringify(ops, undefined, 2))
        window.handleResponse(ops.invoke(relationship, context), done)
      },
      result.id,
      relationship,
      property,
      context
    )
  }

  async invoke (result, relationship, context) {
    return this.manager.executeAsyncScript(
      /* istanbul ignore next: won't work in browser otherwise */
      function (id, relationship, context, done) {
        window.testResults[id]
          .invoke(relationship, context)
          .then(function (resource) {
            window.testResults.push(resource)
            done({ success: true, id: window.testResults.length - 1 })
          })
          .catch(function (error) {
            window.callbackWithError(done, error)
          })
      },
      result.id,
      relationship,
      context
    )
  }

  async getUrls (results) {
    return this.manager.executeAsyncScript(
      /* istanbul ignore next: won't work in browser otherwise */
      function (ids, done) {
        done(
          ids.map(id => {
            return window.testResults[id].response.url
          })
        )
      },
      results.map(result => result.id)
    )
  }

  async getBodies (results) {
    return this.manager.executeAsyncScript(
      /* istanbul ignore next: won't work in browser otherwise */
      function (ids, done) {
        Promise.all(
          ids.map(id => {
            return window.testResults[id].body()
          })
        ).then(bodies => {
          done(bodies)
        })
      },
      results.map(result => result.id)
    )
  }

  async getStatusCode (result) {
    return this.manager.executeAsyncScript(
      /* istanbul ignore next: won't work in browser otherwise */
      function (id, done) {
        done(window.testResults[id].response.status)
      },
      result.id
    )
  }

  async use (handler) {
    const handlerCode = handler
      .toString()
      .replace('_waychaser.Operation', 'Operation')
    logger.debug('handlerCode', handlerCode)
    return this.manager.executeAsyncScript(
      `function (done) {
        window.testWaychaser = window.testWaychaser.use(${handlerCode})
        done()
      }`
    )
  }

  async reset () {
    return this.manager.executeAsyncScript(
      /* istanbul ignore next: won't work in browser otherwise */
      function (done) {
        window.testWaychaser = window.waychaser
        done()
      }
    )
  }

  async useDefaultHandlers () {
    return this.manager.executeAsyncScript(
      /* istanbul ignore next: won't work in browser otherwise */
      function (done) {
        window.testWaychaser.useDefaultHandlers()
        done()
      }
    )
  }
}

export { WaychaserViaWebdriver }
