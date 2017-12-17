import ServiceManager from './ServiceManager';
import ServiceType from './ServiceType';
import ServiceState from "./ServiceState";

/**
 * @param {string} type
 * @private
 */
function _defineLifeCycleMethods(type) {
  this.initialize = () => {};

  if (type !== ServiceType.LOCAL) {
    this.connect = () => {};
    this.disconnect = () => {};
  }

  if (type === ServiceType.PRIVATE) {
    this.authenticate = () => {};
    this.deauthenticate = () => {};
  }
}

/**
 * @param {string} type
 * @param {string} name
 * @param {string[]} dependencies
 * @returns {ServiceManager}
 * @private
 */
function _buildServiceManager(type, name, dependencies) {

  const connect = (type === ServiceType.LOCAL ? null : (disconnect) => {
    this.disconnect = disconnect;
    return this.connect();
  });

  const auth = (type !== ServiceType.PRIVATE ? null : (deauthenticate) => {
    this.deauthenticate = deauthenticate;
    return this.authenticate();
  });

  return new ServiceManager(name, dependencies, () => this.initialize(), connect, auth);
}

function _guardLifeCycleMethods() {

  const original = {
    initialize: this.initialize,
    connect: this.connect,
    authenticate: this.authenticate
  };

  this.initialize = function() {
    if (this.manager().state() !== ServiceState.INITIALIZING) {
      throw new Error('Expected state INITIALIZING, but got ' + this.manager().state() +
        '. Did you mean to call service.manager().initialize() instead of service.initialize()?');
    }

    return original.initialize.call(this);
  };

  if (typeof original.connect !== 'undefined') {
    this.connect = function() {
      if (this.manager().state() !== ServiceState.CONNECTING) {
        throw new Error('Expected state CONNECTING, but got ' + this.manager().state() +
          '. Did you mean to call service.manager().connect() instead of service.connect()?');
      }

      return original.connect.call(this);
    };
  }

  if (typeof original.authenticate !== 'undefined') {
    this.authenticate = function () {
      if (this.manager().state() !== ServiceState.AUTHENTICATING) {
        throw new Error('Expected state AUTHENTICATING, but got ' + this.manager().state() +
          '. Did you mean to call service.manager().authenticate() instead of service.authenticate()?');
      }

      return original.authenticate.call(this);
    };
  }
}

/**
 * @param {ServiceManager} mgr
 * @private
 */
function _installLifeCycleHooks(mgr) {
  mgr.onInitialized(() => {

    if (mgr.type() !== ServiceType.LOCAL) {
      mgr.dependencies().forEach(d => {
        this.get(d).manager().onDisconnected(() => this.disconnect());
      });
    }

    if (mgr.type() === ServiceType.PRIVATE) {
      mgr.dependencies().forEach(d => {
        this.get(d).manager().onDeauthenticated(() => this.deauthenticate());
      });
    }
  });
}

class ServiceBase {
  /**
   * @param {string} type
   * @param {string} name
   * @param {string[]} dependencies
   */
  constructor(type, name, dependencies = []) {
    if (typeof ServiceType[type] === 'undefined') {
      throw new Error('Invalid ServiceType: ' + type);
    }

    _defineLifeCycleMethods.call(this, type);
    this._serviceManager = _buildServiceManager.call(this, type, name, dependencies);
    _installLifeCycleHooks.call(this, this._serviceManager);
    _guardLifeCycleMethods.call(this, this._serviceManager);
  }

  /**
   * @returns {ServiceManager}
   */
  manager() {
    return this._serviceManager;
  }

  /**
   * @param {string} dependency
   * @returns {ServiceBase}
   */
  get(dependency) {
    return this._serviceManager.dependency(dependency);
  }
}

export default ServiceBase;