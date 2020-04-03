(undefined => {

'use strict';

// Do not reuse "global" to be min-safe when shrinking vars + it would be a bad practice
const _global = typeof window === 'object' ? window : // Basic browser context
                typeof global === 'object' ? global : // NodeJS context
                this; // Some unknown context

const nextTick = typeof process === 'object' && process.nextTick

    // Prefer NodeJS method if defined since it creates microtasks
    ? (callback, param) => {
        process.nextTick(callback, param);
    }

    : _global.postMessage

        // Otherwise try using window messaging that is still pretty fast
        ? (() => {

            const messageType = 'promise-job';
            const pool = [];
            let i = -1;

            _global.addEventListener('message', event => {

                if (event.source === _global && event.data.type === messageType) {

                    const job = pool[event.data.i];

                    if (job) {
                        event.stopPropagation();
                        delete pool[event.data.i];
                        job.callback(job.param);
                    }
                }

            }, true);

            return (callback, param) => {

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
        : (callback, param) => {
            _global.setTimeout(callback, 0, param);
        };

// Avoid directly exposing states values, this way states values are always correct when checking internally even if exposed constants were modified from outside
const STATE_PENDING = 0;
const STATE_RUNNING = 1;
const STATE_RESOLVED = 2;
const STATE_REJECTED = 3;

function noopResolve (value) {
    return value;
}

function noopReject (error) {
    throw error;
}

function Promise (_executor) {

    // Private vars

    const self = this;

    let _state = STATE_PENDING;
    let _value;
    const _queue = [];
    const _watchers = [];

    // Private methods

    function _solver (nextState) {

        return value => {

            // Prevent multiple calls to resolve and reject inside executor, a promise is solved only once
            if (_state !== STATE_RUNNING) return;

            _state = nextState;
            _value = value;

            let next;
            while (next = _queue.shift())
                next.run();
        };
    }

    // Privileged public methods
    // https://crockford.com/javascript/private.html

    self.run = () => {

        nextTick(() => {

            // Prevent re-executing a promise
            if (_state !== STATE_PENDING) return;

            _state = STATE_RUNNING;

            try {
                _executor( _solver(STATE_RESOLVED), _solver(STATE_REJECTED), notification => {

                    // Stop notifications as soon as promise is solved
                    // Useful when being notified by raced promises via Promise.race
                    if (_state !== STATE_RUNNING) return;

                    for (const watcher of _watchers)
                        nextTick(watcher, notification);
                });
            }
            // Handle throw in executor as a reject call
            catch (error) {
                _solver(STATE_REJECTED)(error);
            }
        });

        return self;
    };

    self.then = (resolve, reject, notify) => {

        if (notify) _watchers.push(notify);

        const promise = new Promise((nextResolve, nextReject, nextNotify) => {

            let result;
            let success;

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

        // Parent promise is not solved yet
        // Enqueue a child promise that will be executed when parent solves
        if (_state < STATE_RESOLVED) _queue.push(promise);

        // Else parent promise has already been solved at binding time and child promise should have execute too
        else promise.run();

        return promise;
    };

    self.getState = () => {
        return _state;
    };
}

// STATIC METHODS AND CONSTANTS

Promise.STATE_PENDING = STATE_PENDING;
Promise.STATE_RUNNING = STATE_RUNNING;
Promise.STATE_RESOLVED = STATE_RESOLVED;
Promise.STATE_REJECTED = STATE_REJECTED;

Promise.run = executor => new Promise(executor).run();

Promise.all = promises => Promise.run((resolve, reject, notify) => {

    // List of result values of each promises
    // Values are in same order as promises list
    const values = [];

    for (let i = 0; i < promises.length; i++) (i => {
        promises[i].then(value => {

            values[i] = value;

            for (const promise of promises)
                if (promise.getState() !== STATE_RESOLVED)
                    return;

            // Only first call to solve callback will do something
            resolve(values);

        }, reject, notify); // Same remark as Promise.race for the notify callback
    })(i);
});

Promise.race = promises => Promise.run((resolve, reject, notify) => {

    for (const promise of promises)
        // Pass notify callback to allow raced promised to notify
        // Is it a good idea? I don't know but if you don't like it then don't use it!
        promise.then(resolve, reject, notify);
});

Promise.resolve = value => Promise.run((resolve, reject, notify) => {
    resolve(value);
});

Promise.reject = error => Promise.run((resolve, reject, notify) => {
    reject(error);
});

// Converts an RxJS Observable to a Promise the generic way or the one shot way
// earlyResolution = false : Promise may never resolve if Observable#complete is never called
// earlyResolution = true : Promise is resolved on first emitted value from Observable (or completion)
Promise.fromObservable = (observable, earlyResolution) => Promise.run((resolve, reject, notify) => {
    observable.subscribe({
        next: earlyResolution ? resolve : notify,
        error: reject,
        complete: resolve
    });
});

// EXPOSE LIBRARY TO THE OUTSIDE

// Node.js module format (preferred)
if (typeof module === 'object' && typeof module.exports === 'object')
    module.exports = Promise;

// Old browser global exposition (with noConflict method)
else {

    Promise.noConflict = () => {
        _global.Promise = Promise.conflicted;
        return Promise;
    };

    Promise.conflicted = _global.Promise;
    _global.Promise = Promise;
}

})();
