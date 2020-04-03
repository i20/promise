(function (undefined) {

'use strict';

// Do not reuse "global" to be min-safe when shrinking vars + it would be a bad practice
var _global = typeof window === 'object' ? window : // Basic browser context
              typeof global === 'object' ? global : // NodeJS context
              this; // Some unknown context

var nextTick = typeof process === 'object' && process.nextTick

    // Prefer NodeJS method if defined since it creates microtasks
    ? function (callback, param) {
        process.nextTick(callback, param);
    }

    : _global.postMessage

        // Otherwise try using window messaging that is still pretty fast
        ? (function () {

            var messageType = 'promise-job';
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

        })()

        // Cheap fallback to a macrotask
        : function (callback, param) {
            _global.setTimeout(callback, 0, param);
        };

// Avoid directly exposing states values, this way states values are always correct when checking internally even if exposed constants were modified from outside
var STATE_PENDING = 0;
var STATE_RUNNING = 1;
var STATE_RESOLVED = 2;
var STATE_REJECTED = 3;

function noop () {}

function noopResolve (value) {
    return value;
}

function noopReject (error) {
    throw error;
}

function Promise (_executor) {

    // Private vars

    var self = this;

    var _state = STATE_PENDING;
    var _value;
    var _queue = [];
    var _watchers = [];

    // Private methods

    function _solver (nextState) {

        return function (value) {

            // Prevent multiple calls to resolve and reject inside executor, a promise is solved only once
            if (_state !== STATE_RUNNING) return;

            _state = nextState;
            _value = value;

            if (_queue.length) {
                var next;
                while (next = _queue.shift())
                    next.run();
            }

            // Make unhandled rejected promises throw an exception instead of silently fail
            else if (_state === STATE_REJECTED)
                throw _value;
        };
    }

    // Privileged public methods
    // https://crockford.com/javascript/private.html

    self.run = function () {

        nextTick(function () {

            // Prevent re-executing a promise
            if (_state !== STATE_PENDING) return;

            _state = STATE_RUNNING;

            _executor( _solver(STATE_RESOLVED), _solver(STATE_REJECTED), function (notification) {

                // Stop notifications as soon as promise is solved
                // Useful when being notified by raced promises via Promise.race
                if (_state !== STATE_RUNNING) return;

                for (var i = 0; i < _watchers.length; i++)
                    nextTick(_watchers[i], notification);
            });

            // /!\ Do not handle throwing from executor, anyway it would catch only synchronous throws
            // It is coherent with the return behavior (powerless inside executor)
            // Executor is made for asynchrounous business, just use resolve()/reject() inside it
            // By not try-catching executor, we can then throw from _solver() to make unhandled rejections noisy !
        });

        return self;
    };

    self.then = function (resolve, reject, notify) {

        if (notify) _watchers.push(notify);

        var promise = new Promise(function (nextResolve, nextReject, nextNotify) {

            // /!\ If run() is called manually on the new promise whereas parent promise has not
            // solved yet then new promise will be rejected with an undefined value

            // /!\ At the opposite of executor, then() handlers are made to use return/throw

            try {

                var result = (_state === STATE_RESOLVED ? resolve || noopResolve : reject || noopReject)(_value);

                // If handler returns a promise then, it "replaces" the current promise
                if (result instanceof Promise)
                    result.then(nextResolve, nextReject, nextNotify);

                else nextResolve(result);
            }

            catch (error) {
                nextReject(error);
            }
        });

        // Parent promise is not solved yet
        // Enqueue a child promise that will be executed when parent solves
        if (_state < STATE_RESOLVED) _queue.push(promise);

        // Else parent promise has already been solved at binding time and child promise should have execute too
        else promise.run();

        return promise;
    };

    self.catch = function (reject) {
        return self.then(null, reject || noop);
    };

    self.getState = function () {
        return _state;
    };
}

// STATIC METHODS AND CONSTANTS

Promise.STATE_PENDING = STATE_PENDING;
Promise.STATE_RUNNING = STATE_RUNNING;
Promise.STATE_RESOLVED = STATE_RESOLVED;
Promise.STATE_REJECTED = STATE_REJECTED;

Promise.run = function (executor) {
    return new Promise(executor).run();
};

Promise.all = function (promises) {

    return Promise.run(function (resolve, reject, notify) {

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

    return Promise.run(function (resolve, reject, notify) {
        for (var i = 0; i < promises.length; i++)
            // Pass notify callback to allow raced promised to notify
            // Is it a good idea? I don't know but if you don't like it then don't use it!
            promises[i].then(resolve, reject, notify);
    });
};

Promise.resolve = function (value) {

    return Promise.run(function (resolve, reject, notify) {
        resolve(value);
    });
};

Promise.reject = function (error) {

    return Promise.run(function (resolve, reject, notify) {
        reject(error);
    });
};

// Converts an RxJS Observable to a Promise the generic way or the one shot way
// earlyResolution = false : Promise may never resolve if Observable#complete is never called
// earlyResolution = true : Promise is resolved on first emitted value from Observable (or completion)
Promise.fromObservable = function (observable, earlyResolution) {

    return Promise.run(function (resolve, reject, notify) {
        observable.subscribe({
            next: earlyResolution ? resolve : notify,
            error: reject,
            complete: resolve
        });
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
