// TODO implement finally
// TODO implement notify

(function (window, undefined) {

/**/
var object_create = Object.create || function (prototype) {
    function Type () {}
    Type.prototype = prototype;
    return new Type();
};
/**/

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

    return value instanceof Promise ? value : Q(function (resolve, reject) {
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
        _executor( _solver(2), _solver(3), function (notification) {

            // TODO Does it need to be run in next event turn?
            for (var i = 0; i < _watchers.length; i++)
                _watchers[i](notification);
        });

        return self;
    };

    self.then = function (resolve, reject, notify) {

        if (notify)
            _watchers.push(notify);

        // Promise is not solved yet
        if (_state < 2) {

            /**/
            var deferred = Promise.defer();
            _queue.push(function () {
                return _spawn(resolve, reject).then(deferred.resolve, deferred.reject);
            });
            return deferred.promise;
            /**/

            var promise = new Promise(function (nextResolve, nextReject) {
                _spawn(resolve, reject).then(nextResolve, nextReject);
            });

            // Enqueue a child promise that will be executed when current finishes
            _queue.push(promise);
            return promise;
        }
        // Promise has already been solved at binding time
        else return _spawn(resolve, reject);
    };

    self.getState = function () {

        return _state;
    };

    // Private methods

    function _solver (nextState) {

        return function (value) {

            // Run solver in next event loop to ensure execution order
            // https://github.com/kriskowal/q#tutorial
            // https://blog.carbonfive.com/2013/10/27/the-javascript-event-loop-explained/
            setTimeout(function () {

                // Prevent multiple calls to resolve and reject inside executor, a promise is solved only once
                if (_state !== 1) return;

                _state = nextState;
                _value = value;

                while ( _queue.length )
                    _queue.shift().execute();
            }, 0);
        };
    }

    function _spawn (resolve, reject) {

        return convert( (_state === 2 ? resolve || noopResolve : reject || noopReject), _value);
    }
}

Promise.defer = function () {


};

function Q (executor) {

    return new Promise(executor).execute();
}

/**
 * @returns New promise on all promises fulfillment. Resulting promise will be fulfilled with an array of promises result values as soon as all promises will be fulfilled or will be rejected with the error of the first rejected promise.
 * @param promises Array of promises to wait for.
 */
Q.all = function (promises) {

    return Q(function (resolve, reject) {

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

            }, reject);
        })(i);
    });
};

window.Q = Q;

})(this);
