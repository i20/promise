//////////////////////////////////////

// var p1 = Promise.exec(function (resolve, reject) {
//     console.log('START TIMER 1');
//     setTimeout(resolve, 1000, 'exec1');
// });

// var p2 = p1.then(function (value) {
//     console.log('TIMER 1 = ' + value);
//     console.log('START TIMER 2');
//     return Promise.exec(function (resolve, reject) {
//         setTimeout(resolve, 1000, 'exec2');
//     });
// });

// var p3 = p2.then(function (value) {
//     console.log('TIMER 2 = ' + value);
// });

// var p4 = p1.then(function (value) {
//     console.log('TIMER 1 = ' + value);
// });

// var p5 = p1.then(function (value) {
//     throw 'BOOOOOM';
// });

// var p6 = Q.all([p1, p2, p3, p4, p5]).then(function (values) {
//     console.log('ALL DONE', values);
// }, function (error) {
//     console.log('ALL REJECTED', error);
// });

// var p7 = p5
//     .then(function () { console.log('P5 RESOLVED'); })
//     .then(null, function () { console.log('P5 REJECTED'); })
//     .then(function () { console.log('P7 OK'); }, function () { console.log('P7 KO'); });

// var p8 = p1
//     .then(null, function () { console.log('P1 REJECTED'); })
//     .then(function () { console.log('P1 RESOLVED'); })
//     .then(function () { console.log('P8 OK'); }, function () { console.log('P8 KO'); });

var p9 = Promise.exec(function (resolve, reject, notify) {

    var i = 0;

    var interval = setInterval(function () {

        i++;
        notify(i);
        if (i === 10) {
            clearInterval(interval);
            resolve(i);
        }

    }, 1000);
}).then(function (value) {
    console.log('INTERVAL ENDED', value);
}, null, function (notif) {
    console.log('INTERVAL NOTIF', notif);
});

/*
START TIMER 1
---- 1 s
TIMER 1 = exec1
START TIMER 2
TIMER 1 = exec1
ALL REJECTED BOOOOOM
P5 REJECTED
P7 OK
P1 RESOLVED
P8 OK
---- 1 s
TIMER 2 = exec2
# ALL DONE
*/
