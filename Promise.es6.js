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
const STATE_PENDING = 1;
const STATE_RESOLVED = 2;
const STATE_REJECTED = 3;

function noop () {}

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

            // Execute next tick to give a chance to catch any instanlty rejected promise
            // otherwise Promise.reject().catch() would still raise an exception
            // + this way behavior is homogeneous, that way promises are always solved asynchronously
            nextTick(() => {

                // Prevent multiple calls to resolve and reject inside executor, a promise is solved only once
                if (_state !== STATE_PENDING) return;

                _state = nextState;
                _value = value;

                if (_queue.length) {
                    let next;
                    while (next = _queue.shift())
                        next();
                        // nextTick(next);
                }

                // Make unhandled rejected promises throw an exception instead of silently fail
                // As the solver is executed next tick, this exception won't be catched by executor try/catch
                else if (_state === STATE_REJECTED)
                    throw _value;
            });
        };
    }

    // Privileged public methods
    // https://crockford.com/javascript/private.html

    self.then = (resolve, reject, notify) => {

        if (notify) _watchers.push(notify);

        return new Promise((nextResolve, nextReject, nextNotify) => {

            function run () {

                try {

                    const result = (_state === STATE_RESOLVED ? resolve || noopResolve : reject || noopReject)(_value);

                    // If handler returns a promise then, it "replaces" the current promise
                    if (result instanceof Promise)
                        result.then(nextResolve, nextReject, nextNotify);

                    else nextResolve(result);
                }

                catch (error) {
                    nextReject(error);
                }
            }

            // If parent promise is not solved yet then enqueue child promise run()
            // Else parent promise has already been solved at binding time
            _state === STATE_PENDING ? _queue.push(run) : run();
        });
    };

    self.catch = reject => self.then(null, reject || noop);

    self.getState = () => _state;

    // Run
    try {
        // Executor is called synchronously but solver is asynchronous (cf comment in solver)
        // As solver is asynchronous, notifier has to be othewise we could notify after a solver call
        _executor( _solver(STATE_RESOLVED), _solver(STATE_REJECTED), (notification) => {

            nextTick(() => {
                // Stop notifications as soon as promise is solved
                // Useful when being notified by raced promises via Promise.race
                if (_state !== STATE_PENDING) return;

                for (const watcher of _watchers)
                    watcher(notification);
                    // nextTick(watcher, notification);
            });
        });
    }
    // Handle exception (synchronous only) from executor as a reject call
    catch (error) {
        _solver(STATE_REJECTED)(error);
    }
}

// STATIC METHODS AND CONSTANTS

Promise.STATE_PENDING = STATE_PENDING;
Promise.STATE_RESOLVED = STATE_RESOLVED;
Promise.STATE_REJECTED = STATE_REJECTED;

Promise.all = promises => new Promise((resolve, reject, notify) => {

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

Promise.race = promises => new Promise((resolve, reject, notify) => {

    for (const promise of promises)
        // Pass notify callback to allow raced promised to notify
        // Is it a good idea? I don't know but if you don't like it then don't use it!
        promise.then(resolve, reject, notify);
});

Promise.resolve = value => new Promise((resolve, reject, notify) => {
    resolve(value);
});

Promise.reject = error => new Promise((resolve, reject, notify) => {
    reject(error);
});

// Converts an RxJS Observable to a Promise the generic way or the one shot way
// earlyResolution = false : Promise may never resolve if Observable#complete is never called
// earlyResolution = true : Promise is resolved on first emitted value from Observable (or completion)
Promise.fromObservable = (observable, earlyResolution) => new Promise((resolve, reject, notify) => {
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
