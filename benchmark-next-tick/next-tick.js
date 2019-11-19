(function (global, undefined) {

    'use strict'

    global.nextTickPM = (function () {

        var messageType = 'promise-job';
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

    })();

    global.nextTickTO = function (callback, param) {

        setTimeout(callback, 0, param);
    };

    global.nextTickPR = function (callback, param) {

        Promise.resolve().then(callback);
    };

})(this);
