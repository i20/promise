(function (global, undefined) {

'use strict';

var nextTick = global.process && global.process.nextTick ? function (callback, param) { // Prefer Node.js method if defined since it creates microtasks
    global.process.nextTick(callback, param);
} : global.postMessage ? (function () { // Otherwise try using window messaging that is still pretty fast

    var messageType = 'i20-promise-job';
    var pool = [];
    var i = -1;

    global.addEventListener('message', function (event) {

        if (event.source === global && event.data.type === messageType) {

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

        global.postMessage({
            type: messageType,
            i: i
        }, '*');
    };

})() : function (callback, param) { // Cheap fallback to a macrotask
    global.setTimeout(callback, 0, param);
};

function noopResolve (value) {
    return value;
}

function noopReject (error) {
    throw error;
}

function Promise (_executor) {

    var self = this;

    var _state = Promise.STATE_PENDING;
    var _value;
    var _queue = [];
    var _watchers = [];

    // Privileged methods
    // https://crockford.com/javascript/private.html

    self.execute = function () {

        // Prevent re-executing a promise
        if (_state !== Promise.STATE_PENDING) return;

        _state = Promise.STATE_RUNNING;

        try {
            _executor( _solver(Promise.STATE_RESOLVED), _solver(Promise.STATE_REJECTED), function (notification) {

                // Stop notifications as soon as promise is solved
                // Useful when being notified by raced promises via Promise.race
                if (_state !== Promise.STATE_RUNNING) return;

                for (var i = 0; i < _watchers.length; i++)
                    nextTick(_watchers[i], notification);
            });
        }
        // Handle throw in executor as a reject call
        catch (error) {
            _solver(Promise.STATE_REJECTED)(error);
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
                result = (_state === Promise.STATE_RESOLVED ? resolve || noopResolve : reject || noopReject)(_value);
                success = true;
            }

            catch (error) {
                result = error;
                success = false;
            }

            if (result instanceof Promise)
                result.then(nextResolve, nextReject, nextNotify);

            else (success ? nextResolve : nextReject)(result);
        });

        // Promise is not solved yet
        // Enqueue a child promise that will be executed when current finishes
        if (_state < Promise.STATE_RESOLVED) _queue.push(promise);

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
            if (_state !== Promise.STATE_RUNNING) return;

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

Promise.STATE_PENDING = 0;
Promise.STATE_RUNNING = 1;
Promise.STATE_RESOLVED = 2;
Promise.STATE_REJECTED = 3;

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
                    if (promises[j].getState() !== Promise.STATE_RESOLVED)
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

Promise.noConflict = function () {
    global.Promise = Promise.conflicted;
    return Promise;
};

Promise.conflicted = global.Promise;
global.Promise = Promise;

})(this);
