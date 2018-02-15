1. [About](#about)
2. [Use it](#use-it)
    1. [Load the library](#load-the-library)
    2. [Create a promise](#create-a-promise)
    3. [Wait for a promise to be resolved/rejected](#wait-for-a-promise-to-be-resolvedrejected)
    4. [Chain promises](#chain-promises)
    5. [Follow a promise progress](#follow-a-promise-progress)
    6. [Combine promises](#combine-promises)
3. [API Reference](#api-reference)
4. [In the pipe](#in-the-pipe)
5. [References](#references)

# About

**Promise.js** is a simple and lighweight JS promise library I made after discovering *Angular's $q* and [*Kris Kowal's Q*](https://github.com/kriskowal/q). 

JS promises just make the code more elegant by avoiding the *pyramid of doom* of too many nested callbacks when using asynchronous calls.

As you know, promises are **now native** in most up-to-date JS engines via the constructor `Promise`. My library has no pretention to be better than native code and you should always prefer native implementation if concerned about code general quality. But if you're always eager to understand what happens under the hood like me feel free to use/fork/improve **Promise.js**, I will be happy to hear any constructive suggestion! :neckbeard:

# Use it

## Load the library

To start using **Promise.js** just include the file with a traditionnal `<script>` tag and you're good to go !

## Create a promise

You can create a promise from any asynchronous code by wrapping it in an **executor function** as follow :

```javascript
var myPromise = Promise.exec(function (resolve, reject, notify) {
    setTimeout(resolve, 1000, 'Hello world !');
});
```

The example code above will simply create a promise that will be resolved at least 1000 ms in the future with the value `'Hello world !'`.

Upon wrapped code execution, the *executor function* will be injected 3 callbacks that you can use to **resolve**/**reject** the created promise or just **notify** watchers of its progress. Each of these callbacks accepts one argument that will be in turn passed to callbacks attached via `Promise#then`, see the [*Wait for a promise to be resolved/rejected*](#wait-for-a-promise-to-be-resolvedrejected) section.

NB1 : Note that as a promise can be whether resolved *or* rejected only once, multiple calls to `resolve`/`reject` won't have any effect, the first to be called will determine the promise final state. On the other hand `notify` can be called as much as you want, see the [*Follow a promise progress*](#follow-a-promise-progress) section.

NB2 : Throwing something in the *executor function* will have the same effect as calling `reject` and passing it the thrown value as parameter.

---

Alternatively, you can create a new promise that will not be executed right away by using the constructor `new Promise(function (resolve, reject, notify) { ... })`. The `Promise` object created will be executed only once `Promise#execute()` will be called :

```javascript
var myPromise = new Promise(function (resolve, reject, notify) {
    console.log('Promise executed !');
});

setTimeout(function () {
    myPromise.execute();
}, 1000);

// console.log will happen at least 2000 ms after
```
In fact `Promise.exec(executor)` is a shorthand for `new Promise(executor).execute()`.

## Wait for a promise to be resolved/rejected

Every `Promise` object has a method `Promise#then` that allows you to attach callbacks to be executed whenever the promise will solve. `Promise#then` takes 3 parameters :

- a **resolution** callback that will be called (if promise has been resolved) on the value passed to the *resolve* call.
- a **rejection** callback that will be called on the value passed to the *reject* call (if promise has been rejected).
- a **notification** callback, see the [*Follow a promise progress*](#follow-a-promise-progress) section.

```javascript
var myPromise = Promise.exec(function (resolve, reject, notify) {
    setTimeout(resolve, 1000, 'Hello world !');
});

myPromise.then(function (value) {
    console.log(value);
});

// Will console.log('Hello world !') at least 1000 ms after
```

In the example above we attached a callback to the resolution of the promise but we can also listen for rejection :
 
```javascript
var myPromise = Promise.exec(function (resolve, reject, notify) {
    setTimeout(function () {
    
        Math.random() * 10 < 5 ? 
            reject('Random < 5') : 
            resolve('Random >= 5')
        ;
    
    }, 1000);
});

myPromise.then(function (value) {
    console.log('Successed with :', value);
}, function (error) {
    console.log('Failed with :', error);
});
```

:warning: Callbacks attached via `Promise#then` will always be run asynchronously. Asynchronous execution of handlers guarantees you that `Promise#then` will always return before the handler is called (even if it has been attached on an already solved promise). **Promise.js** tries to use the fastest asynchronous scheduling method, prefering microtasks over macrotasks when available. If you don't know much about these I encourage you to have a look at this [amazing post](https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/).

## Chain promises

`Promise#then` returns a new promise and therefore allows you to chain calls :

```javascript
Promise.exec(function (resolve, reject, notify) {
    setTimeout(resolve, 1000, 'P1');
}).then(function (value) {
    return value.toLowerCase();
}).then(function (value) {
    console.log(value);
});

// Will console.log('p1')
```

You can also reject any promise in the chain by throwing an error :

```javascript
Promise.exec(function (resolve, reject, notify) {
    setTimeout(resolve, 1000, 'P1');
}).then(function (value) {
    throw 'I am not in the mood';
}).then(function (value) {
    console.log(value); 
}, function (error) {
    console.log('An error has happened', error);
});

// Will console.log('An error has happened', 'I am not in the mood')
```

You can also, and it's a very common case, return another promise :

```javascript
Promise.exec(function (resolve, reject, notify) {
    setTimeout(resolve, 1000, 2000);
}).then(function (value) {
    return Promise.exec(function (resolve, reject, notify) {
        setTimeout(resolve, value, 'Timers done !');
    });
}).then(function (value) {
    console.log(value);
});

// Will console.log('Timers done !') at least 3000 ms after
```

When a promise is resolved but you didn't provided a `resolveCallback` to `Promise#then` *or* is rejected but no `rejectCallback` was provided, then the new promise returned keeps the parent promise state :

```javascript
Promise.exec(function (resolve, reject, notify) {
    setTimeout(reject, 1000, 'Timer failed');
}).then(function (value) {
    console.log('Timer done !');
}).then(null, function (error) {
    console.log('An error has happened', error);
});

// Will console.log('An error has happened', 'Timer failed')
```

Now imagine replacing all these `setTimeout` calls by some AJAX ones !

## Follow a promise progress

It can be useful for example in a case of file upload to be able to follow the upload promise progress to display a progress indicator to the end user, that's what the `notifyCallback` of `Promise#then` is done for !

```javascript
var p = Promise.exec(function (resolve, reject, notify) {

    var i = 0;

    var interval = setInterval(function () {

        i += 10;
        notify(i);
        
        if (i === 100) {
            clearInterval(interval);
            resolve('Upload successful !');
        }

    }, 1000);
    
}).then(function (value) {
    console.log(value);
}, null, function (notif) {
    console.log('Upload progress : ', notif + '%');
});

// Will display :
// Upload progress : 10% (wait 1000 ms)
// Upload progress : 20% (wait 1000 ms)
// ...                   (wait 1000 ms)
// Upload progress : 100%
// Upload successful !
```

## Combine promises

If running multiple promises in parallel, you can combine them to wait for the whole with `Promise.all` :

```javascript
var p1 = Promise.exec(function (resolve, reject, notify) {
    setTimeout(resolve, 2000, 'p1');
});

var p2 = Promise.exec(function (resolve, reject, notify) {
    setTimeout(resolve, 1000, 'p2');
});

Promise.all([p1, p2]).then(function (values) {
    console.log(values);
});

// Will console.log(['p1', 'p2']) at least 2000 ms after
```

Or race them to find the first to solve with `Promise.race` :

```javascript
var p1 = Promise.exec(function (resolve, reject, notify) {
    setTimeout(resolve, 2000, 'p1');
});

var p2 = Promise.exec(function (resolve, reject, notify) {
    setTimeout(resolve, 1000, 'p2');
});

Promise.race([p1, p2]).then(function (value) {
    console.log(value);
});

// Will console.log('p2') at least 1000 ms after
```

NB : Note that eventual notifications from combined promises `p1` and `p2` will be passed in the order they happen to the resulting promise watchers, see the [*Follow a promise progress*](#follow-a-promise-progress) section. Notifications from late promises won't no more be catched as soon as a resolution state will be determined.

# API Reference

`Promise.exec(function (resolve, reject, notify) { ... })` takes an **executor function** and returns a new promise that is instantly executed, see the [*Create a promise*](#create-a-promise) section.

---

`Promise#getState()` returns the promise state :

- `0` = *pending*, promise has been created but code execution has not been triggered
- `1` = *executing*, promise execution has started but is always running
- `2` = *resolved*
- `3` = *rejected*

---

`Promise#execute()` triggers promise execution and returns it, see the [*Create a promise*](#create-a-promise) section.

---

`Promise#then(resolveCallback, rejectCallback, notifyCallback)` attaches resolution callbacks to a promise and returns a new promise on top of `resolveCallback` *or* `rejectCallback` execution depending on promise final status. The `notifyCallback` can be used to attach a watcher function on the progress of the promise, see the [*Follow a promise progress*](#follow-a-promise-progress) section.

The new promise returned will be resolved with the return value of the `resolveCallback`/`rejectCallback` *or* be rejected with the value thrown from them. If a `Promise` object is explicitly returned then the resulting promise will become that returned promise, see the [*Chain promises*](#chain-promises) section.

---

`Promise.all([promises])` takes an array of promises and returns a new one that will be whether :

- **resolved** with an array of promises resolution values as soon as they **all will be resolved**. Resolution values are in the same order as passed in promises.
- **rejected** with the rejection value of the **first rejected promise**.

---

`Promise.race([promises])` takes an array of promises and returns a new one that will be **resolved**/**rejected** the same way the **first finishing** passed in promise will be.

---

`Promise.noConflict()` can be called to avoid naming conflicts with others promise libraries (or native `Promise` object). It returns the `Promise` object from this library and restores the original global one.

```javascript
// Load some promise library that exposes Promise (let's name it lib1)
// Load Promise.js that also exposes Promise
var PromiseJS = Promise.noConflict();
// Promise = lib1 Promise
// PromiseJS = Promise.js Promise
```

# In the pipe

- Implement a `finally` callback.
- Make unhandled rejections throw an exception.
- Improve `nextTick` asynchronous scheduling (`Object.observe`, `MutationObserver`). 

# References

- [https://promisesaplus.com/]()
- [https://github.com/kriskowal/q]()
- [https://blog.carbonfive.com/2013/10/27/the-javascript-event-loop-explained/]()
- [https://developer.mozilla.org/fr/docs/Web/JavaScript/Concurrence_et_boucle_des_%C3%A9v%C3%A9nements]()
- [https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/]()
- [http://voidcanvas.com/setimmediate-vs-nexttick-vs-settimeout/]()
- [https://nodejs.org/api/process.html#process_process_nexttick_callback_args]()
- [https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/]()
- [http://stackoverflow.com/q/18826570/1768303]()
- [https://stackoverflow.com/questions/25915634/difference-between-microtask-and-macrotask-within-an-event-loop-context]()
