QUnit.module('Core behavior', function () {

    QUnit.test('Synchronous exception from executor can be catched', function (assert) {

        var done = assert.async();

        new Promise(function (resolve, reject, notify) {
            throw 'exception';
        }).then(null, function (error) {
            assert.ok(true, 'Successfully catched');
            done();
        });
    });

    QUnit.test('Promise solving is always asynchronous', function (assert) {

        var promise = new Promise(function (resolve, reject, notify) {
            resolve();
        });

        assert.strictEqual(promise.getState(), Promise.STATE_PENDING, 'State is pending');
    });

    QUnit.test('Catch instantly rejected promise', function (assert) {

        var done = assert.async();

        new Promise(function (resolve, reject, notify) {
            reject();
        }).then(null, function (error) {
            assert.ok(true, 'Successfully catched');
            done();
        });
    });

    // // Should raise an exception
    // QUnit.test('Uncatched rejected promises rise', function (assert) {

    //     var done = assert.async();

    //     new Promise(function (resolve, reject, notify) {
    //         reject();
    //     });
    // });

    //

    QUnit.test('Resolution', function (assert) {

        var done = assert.async();

        new Promise(function (resolve, reject, notify) {
            setTimeout(resolve, 100, 'resolved');
        }).then(function (value) {
            assert.ok(true, 'Successfully resolved');
            assert.strictEqual(value, 'resolved', 'Resolution value is correct');
            done();
        }, function (error) {
            assert.ok(false, 'Successfully resolved');
            done();
        });
    });

    QUnit.test('Rejection', function (assert) {

        var done = assert.async();

        new Promise(function (resolve, reject, notify) {
            setTimeout(reject, 100, 'rejected');
        }).then(function (value) {
            assert.ok(false, 'Successfully rejected');
            done();
        }, function (error) {
            assert.ok(true, 'Successfully rejected');
            assert.strictEqual(error, 'rejected', 'Rejection value is correct');
            done();
        });
    });

    QUnit.test('Solving defer', function (assert) {

        var done = assert.async();
        var now = Date.now();
        var delay = 100;

        new Promise(function (resolve, reject, notify) {
            setTimeout(resolve, delay, 'resolved');
        }).then(function (value) {
            var then = Date.now();
            assert.ok(now + delay <= then, 'Solving was postponed to at least ' + delay + 'ms');
            done();
        });
    });

    QUnit.test('Progress notification', function (assert) {

        var done = assert.async();
        var goal = 10;
        var i = 0;

        assert.expect(goal);

        new Promise(function (resolve, reject, notify) {
            var interval = setInterval(function () {

                i++;
                notify(i);
                if (i === goal) {
                    clearInterval(interval);
                    resolve(i);
                }

            }, 100);
        }).then(function (value) {
            done();
        }, null, function (notif) {
            assert.strictEqual(notif, i, 'Notification value is correct');
        });
    });

    QUnit.test('Catching with callback', function (assert) {

        var done = assert.async();

        new Promise(function (resolve, reject, notify) {
            reject('rejected');
        }).catch(function (error) {
            assert.ok(true, 'Successfully catched');
            assert.strictEqual(error, 'rejected', 'Catched value is correct');
            done();
        });
    });

    QUnit.test('Catching without callback', function (assert) {

        var done = assert.async();

        new Promise(function (resolve, reject, notify) {
            reject('rejected');
        }).catch().then(function () {
            assert.ok(true, 'Successfully catched');
            done();
        });
    });
});

QUnit.module('Chaining', function () {

    QUnit.test('Resolution -> resolution / simple value', function (assert) {

        var done = assert.async();

        new Promise(function (resolve, reject, notify) {
            setTimeout(resolve, 100, 'resolved');
        }).then(function (value) {
            return value.toUpperCase();
        }).then(function (value) {
            assert.strictEqual(value, 'RESOLVED', 'Resolution value is correct');
            done();
        });
    });

    QUnit.test('Rejection -> resolution / simple value', function (assert) {

        var done = assert.async();

        new Promise(function (resolve, reject, notify) {
            setTimeout(reject, 100, 'rejected');
        }).then(null, function (error) {
            return error.toUpperCase();
        }).then(function (value) {
            assert.strictEqual(value, 'REJECTED', 'Resolution value is correct');
            done();
        });
    });

    QUnit.test('Resolution -> rejection / simple value', function (assert) {

        var done = assert.async();

        new Promise(function (resolve, reject, notify) {
            setTimeout(resolve, 100, 'resolved');
        }).then(function (value) {
            throw value.toUpperCase();
        }).then(null, function (error) {
            assert.strictEqual(error, 'RESOLVED', 'Rejection value is correct');
            done();
        });
    });

    QUnit.test('Rejection -> rejection / simple value', function (assert) {

        var done = assert.async();

        new Promise(function (resolve, reject, notify) {
            setTimeout(reject, 100, 'rejected');
        }).then(null, function (error) {
            throw error.toUpperCase();
        }).then(null, function (error) {
            assert.strictEqual(error, 'REJECTED', 'Rejection value is correct');
            done();
        });
    });

    QUnit.test('New promise', function (assert) {

        var done = assert.async();

        new Promise(function (resolve, reject, notify) {
            setTimeout(resolve, 100, 'resolved');
        }).then(function (value) {
            return new Promise(function (resolve, reject, notify) {
                setTimeout(resolve, 100, value.toUpperCase());
            });
        }).then(function (value) {
            assert.strictEqual(value, 'RESOLVED', 'Resolution value is correct');
            done();
        });
    });
});

QUnit.module('Combination', function () {

    QUnit.module('All', function () {

        QUnit.test('Resolution', function (assert) {

            var done = assert.async();

            var p1 = new Promise(function (resolve, reject, notify) {
                setTimeout(resolve, 200, 'resolved1');
            });

            var p2 = new Promise(function (resolve, reject, notify) {
                setTimeout(resolve, 100, 'resolved2');
            });

            Promise.all([p1, p2]).then(function (values) {
                assert.ok(true, 'Successfully resolved');
                assert.deepEqual(values, ['resolved1', 'resolved2'], 'Resolution values are correct');
                done();
            }, function (error) {
                assert.ok(false, 'Successfully resolved');
                done();
            });
        });

        QUnit.test('Rejection', function (assert) {

            var done = assert.async();

            var p1 = new Promise(function (resolve, reject, notify) {
                setTimeout(resolve, 200, 'resolved1');
            });

            var p2 = new Promise(function (resolve, reject, notify) {
                setTimeout(reject, 100, 'rejected2');
            });

            Promise.all([p1, p2]).then(function (values) {
                assert.ok(false, 'Successfully rejected');
                done();
            }, function (error) {
                assert.ok(true, 'Successfully rejected');
                assert.strictEqual(error, 'rejected2', 'Rejection value is correct');
                done();
            });
        });
    });

    QUnit.module('Race', function () {

        QUnit.test('Resolution', function (assert) {

            var done = assert.async();

            var p1 = new Promise(function (resolve, reject, notify) {
                setTimeout(resolve, 200, 'resolved1');
            });

            var p2 = new Promise(function (resolve, reject, notify) {
                setTimeout(resolve, 100, 'resolved2');
            });

            Promise.race([p1, p2]).then(function (value) {
                assert.ok(true, 'Successfully resolved');
                assert.strictEqual(value, 'resolved2', 'Resolution value is correct');
                done();
            }, function (error) {
                assert.ok(false, 'Successfully resolved');
                done();
            });
        });

        QUnit.test('Rejection', function (assert) {

            var done = assert.async();

            var p1 = new Promise(function (resolve, reject, notify) {
                setTimeout(resolve, 200, 'resolved1');
            });

            var p2 = new Promise(function (resolve, reject, notify) {
                setTimeout(reject, 100, 'rejected2');
            });

            Promise.race([p1, p2]).then(function (value) {
                assert.ok(false, 'Successfully rejected');
                done();
            }, function (error) {
                assert.ok(true, 'Successfully rejected');
                assert.strictEqual(error, 'rejected2', 'Rejection value is correct');
                done();
            });
        });
    });
});

QUnit.test('Execution flow', function (assert) {

    var done = assert.async();
    var i = 0;

    var p1 = new Promise(function (resolve, reject, notify) {
        setTimeout(resolve, 100, i++);
    });

    var p2 = p1.then(function (value) {
        return i++;
    });

    var p3 = p2.then(function (value) {
        return i++;
    });

    var p4 = p1.then(function (value) {
        return i++;
    });

    var p5 = p4.then(function (value) {
        return i++;
    });

    var p6 = p2.then(function (value) {
        return i++;
    });

    Promise.all([p1, p2, p3, p4, p5, p6]).then(function (flow) {
        assert.deepEqual(flow, [0, 1, 3, 2, 5, 4], 'Flow is correct');
        done();
    });
});
