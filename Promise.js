(function (undefined) {

'use strict';

// Do not reuse "global" to be min-safe when shrinking vars + it would be a bad practice
var _global = typeof window === 'object' ? window : // Basic browser context
              typeof global === 'object' ? global : // NodeJS context
              this; // Some unknown context

var nextTick = typeof process === 'object' && process.nextTick ? function (callback, param) { // Prefer Node.js method if defined since it creates microtasks
    process.nextTick(callback, param);
} : _global.postMessage ? (function () { // Otherwise try using window messaging that is still pretty fast

    var messageType = 'i20-promise-job';
    var pool = [];
    var i = -1;

    _global.addEventListener('message', function (event) {

        if (event.source === _global && event.data.type === messageType) {

            var job = pool[event.data.i];

            if (job) {
                event.stopPropagation();
                delete pool[event.data.i];
                job.callback(job.param);
            }
        }

    }, true);

    return function (callback, param) {

        pool[++i] = {
            callback: callback,
            param: param
        };

        _global.postMessage({
            type: messageType,
            i: i
        }, '*');
    };

})() : function (callback, param) { // Cheap fallback to a macrotask
    _global.setTimeout(callback, 0, param);
};

// Avoid directly exposing states values, this way states values are always correct when checking internally even if exposed constants were modified from outside
var STATE_PENDING = 0;
var STATE_RUNNING = 1;
var STATE_RESOLVED = 2;
var STATE_REJECTED = 3;

function noopResolve (value) {
    return value;
}

function noopReject (error) {
    throw error;
}

function Promise (_executor) {

    var self = this;

    var _state = STATE_PENDING;
    var _value;
    var _queue = [];
    var _watchers = [];

    // Privileged methods
    // https://crockford.com/javascript/private.html

    self.execute = function () {

        // Prevent re-executing a promise
        if (_state !== STATE_PENDING) return;

        _state = STATE_RUNNING;

        try {
            _executor( _solver(STATE_RESOLVED), _solver(STATE_REJECTED), function (notification) {

                // Stop notifications as soon as promise is solved
                // Useful when being notified by raced promises via Promise.race
                if (_state !== STATE_RUNNING) return;

                for (var i = 0; i < _watchers.length; i++)
                    nextTick(_watchers[i], notification);
            });
        }
        // Handle throw in executor as a reject call
        catch (error) {
            _solver(STATE_REJECTED)(error);
        }

        return self;
    };

    self.then = function (resolve, reject, notify) {

        if (notify)
            _watchers.push(notify);

        var promise = new Promise(function (nextResolve, nextReject, nextNotify) {

            var result;
            var success;

            try {
                result = (_state === STATE_RESOLVED ? resolve || noopResolve : reject || noopReject)(_value);
                success = true;
            }

            catch (error) {
                result = error;
                success = false;
            }

            // If handler's result is a promise then, whether it was thrown or returned, it "replaces" the current promise
            if (result instanceof Promise)
                result.then(nextResolve, nextReject, nextNotify);

            else (success ? nextResolve : nextReject)(result);
        });

        // Promise is not solved yet
        // Enqueue a child promise that will be executed when current finishes
        if (_state < STATE_RESOLVED) _queue.push(promise);

        // Promise has already been solved at binding time
        else nextTick(function () {
            promise.execute();
        });

        return promise;
    };

    self.getState = function () {
        return _state;
    };

    // Private methods

    function _solver (nextState) {

        return function (value) {

            // Prevent multiple calls to resolve and reject inside executor, a promise is solved only once
            if (_state !== STATE_RUNNING) return;

            _state = nextState;
            _value = value;

            while ( _queue.length ) {
                nextTick(function (next) {
                    next.execute();
                }, _queue.shift());
            }
        };
    }
}

// STATIC METHODS AND CONSTANTS

Promise.STATE_PENDING = STATE_PENDING;
Promise.STATE_RUNNING = STATE_RUNNING;
Promise.STATE_RESOLVED = STATE_RESOLVED;
Promise.STATE_REJECTED = STATE_REJECTED;

Promise.exec = function (executor) {
    return new Promise(executor).execute();
};

Promise.all = function (promises) {

    return Promise.exec(function (resolve, reject, notify) {

        // List of result values of each promises
        // Values are in same order as promises list
        var values = [];

        for (var i = 0; i < promises.length; i++) (function (i) {
            promises[i].then(function (value) {

                values[i] = value;

                for (var j = 0; j < promises.length; j++)
                    if (promises[j].getState() !== STATE_RESOLVED)
                        return;

                // Only first call to solve callback will do something
                resolve(values);

            }, reject, notify); // Same remark as Promise.race for the notify callback
        })(i);
    });
};

Promise.race = function (promises) {

    return Promise.exec(function (resolve, reject, notify) {
        for (var i = 0; i < promises.length; i++)
            // Pass notify callback to allow raced promised to notify
            // Is it a good idea? I don't know but if you don't like it then don't use it!
            promises[i].then(resolve, reject, notify);
    });
};

// EXPOSE LIBRARY TO THE OUTSIDE

// Node.js module format (preferred)
if (typeof module === 'object' && typeof module.exports === 'object')
    module.exports = Promise;

// Old browser global exposition (with noConflict method)
else {

    Promise.noConflict = function () {
        _global.Promise = Promise.conflicted;
        return Promise;
    };

    Promise.conflicted = _global.Promise;
    _global.Promise = Promise;
}

})();
