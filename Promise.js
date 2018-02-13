(function (global, undefined) {

'use strict';

// Prefer Node.js method if defined
var nextTick = (global.process && global.process.nextTick) || function (callback, param) {

    // Cheap fallback nextTick method to run a code asynchronously
    setTimeout(callback, 0, param);
};

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

    var _state = 0; // 0 pending, 1 executing, 2 resolved, 3 rejected
    var _value;
    var _queue = [];
    var _watchers = [];

    // Privileged methods
    // https://crockford.com/javascript/private.html

    self.execute = function () {

        // Prevent re-executing a promise
        if (_state !== 0) return;

        _state = 1;

        try {
            _executor( _solver(2), _solver(3), function (notification) {

                // Stop notifications as soon as promise is solved
                // Useful when being notified by raced promises via Promise.race
                if (_state !== 1) return;

                for (var i = 0; i < _watchers.length; i++)
                    nextTick(_watchers[i], notification);
            });
        }
        // Handle throw in executor as a reject call
        catch (error) {
            _solver(3)(error);
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
        if (_state < 2) _queue.push(promise);

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
            if (_state !== 1) return;

            _state = nextState;
            _value = value;

            while ( _queue.length )
                nextTick( _queue.shift().execute );
        };
    }

    function _spawn (resolve, reject) {

        return convert( (_state === 2 ? resolve || noopResolve : reject || noopReject), _value);
    }
}

// STATIC METHODS

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
                    if (promises[j].getState() !== 2)
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
