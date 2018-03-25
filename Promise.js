(function (global, undefined) {

'use strict';

var nextTick =
// Prefer Node.js method if defined since it creates microtasks
(global.process && global.process.nextTick) ||
// Otherwise try using window messaging that is still pretty fast
(global.postMessage ? (function () {

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

})() :
// Cheap fallback to a macrotask
function (callback, param) {
    global.setTimeout(callback, 0, param);
});

function convert (callback, param) {

    var value;
    var success;

    try {
        value = callback(param);
        success = true;
    }

    catch (error) {
        value = error;
        success = false;
    }

    return value instanceof Promise ? value : Promise.exec(function (resolve, reject, notify) {
        (success ? resolve : reject)(value);
    });
}

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
            _spawn(resolve, reject).then(nextResolve, nextReject, nextNotify);
        });

        // Promise is not solved yet
        // Enqueue a child promise that will be executed when current finishes
        if (_state < Promise.STATE_RESOLVED) _queue.push(promise);

        // Promise has already been solved at binding time
        else nextTick(promise.execute);

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

            while ( _queue.length )
                nextTick( _queue.shift().execute );
        };
    }

    function _spawn (resolve, reject) {
        return convert( (_state === Promise.STATE_RESOLVED ? resolve || noopResolve : reject || noopReject), _value);
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
