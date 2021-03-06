import { abstract } from '../../util/abstract'
import logger from '../../util/logger'

class WaychaserProxy {
  /* istanbul ignore next: only gets executed if we didn't overload this method */
  async load (url) {
    abstract()
  }

  /* istanbul ignore next: only gets executed if we didn't overload this method */
  async getOCount (property, result) {
    abstract()
  }

  async getOperationsCount (result) {
    return this.getOCount('operations', result)
  }

  async getOpsCount (result) {
    return this.getOCount('ops', result)
  }

  /* istanbul ignore next: only gets executed if we didn't overload this method */
  async findOne (result, relationship) {
    abstract()
  }

  /* istanbul ignore next: only gets executed if we didn't overload this method */
  async invokeO (property, result, relationship, context) {
    abstract()
  }

  async invokeOperation (result, relationship, context) {
    logger.debug('OPERATION CONTEXT', context)
    return this.invokeO('operations', result, relationship, context)
  }

  async invokeOp (result, relationship, context) {
    logger.debug('OP CONTEXT', context)
    return this.invokeO('ops', result, relationship, context)
  }

  /* istanbul ignore next: only gets executed if we didn't overload this method */
  async invoke (result, relationship, context) {
    abstract()
  }

  /* istanbul ignore next: only gets executed if we didn't overload this method */
  async getUrls (result, context) {
    abstract()
  }

  /* istanbul ignore next: only gets executed if we didn't overload this method */
  async getBodies (results) {
    abstract()
  }

  /* istanbul ignore next: only gets executed if we didn't overload this method */
  async getStatusCode (result) {
    abstract()
  }

  /* istanbul ignore next: only gets executed if we didn't overload this method */
  async use (handler) {
    abstract()
  }

  /* istanbul ignore next: only gets executed if we didn't overload this method */
  async reset () {
    abstract()
  }

  /* istanbul ignore next: only gets executed if we didn't overload this method */
  async useDefaultHandlers () {
    abstract()
  }
}

export { WaychaserProxy }
