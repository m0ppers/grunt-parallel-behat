var exec = require('child_process').exec,
    _ = require('underscore'),
    EventEmitter = require('events').EventEmitter;

/**
 * Run some commands in parallel
 *
 * @param {Number} maxTasks
 * @param {Object} execOptions
 */
function ParallelExec (maxTasks, execOptions) {
    var running = false,
        i,
        queue = [],
        runningTasks = 0,
        workers = [];

    for (i = 0;i < maxTasks;i++) {
        workers[i] = false;
    }

    /**
     * True if there are items on the queue and we have space to run a task
     *
     * @return {boolean}
     */
    function canStartTask () {
        return queue.length > 0 && running && runningTasks < maxTasks;
    }

    /**
     * Adds a task to the queue and starts the next task if there is space.
     *
     * @param {string} cmd
     */
    function addTask (cmd) {
        queue.push(cmd);

        if (canStartTask()) {
            startNextTask();
        }
    }

    function findWorker() {
        var workerId,
            i;

        for (i = 0;i < workers.length && typeof workerId == 'undefined';i++) {
            if (workers[i] == false) {
                workerId = i;
            }
        }
        return workerId;
    }

    function startWorker(cmd) {
        var workerId = findWorker(),
            finalCmd;

        if (typeof workerId === 'undefined') {
            throw new Error('Could not find a free worker');
        }
        runningTasks++;
        finalCmd = cmd.replace(/#workerId#/, workerId);
        workers[workerId] = true;
        var freeWorkerAndDone = function(cmd, err, stdout, stderr) {
            workers[workerId] = false;
            taskDone(cmd, err, stdout, stderr);
        }
        exec(finalCmd, execOptions, _.partial(freeWorkerAndDone, cmd));
    }

    /**
     * Shift the next task from the queue and start it up
     */
    function startNextTask () {
        if (canStartTask()) {
            var cmd = queue.shift();

            this.emit('startedTask', cmd);
            startWorker(cmd);
        }
    }

    /**
     * Decrement the running tasks and start the next one
     */
    function taskDone (cmd, err, stdout, stderr) {
        runningTasks--;
        this.emit('finishedTask', cmd, err, stdout, stderr);

        if (canStartTask()) {
            startNextTask();
        }
        else if (runningTasks === 0) {
            this.emit('finished');
        }
    }

    /**
     * Start the tasks running
     */
    function start () {
        running = true;

        _.times(maxTasks - runningTasks, startNextTask);
    }

    startNextTask = startNextTask.bind(this);
    taskDone = taskDone.bind(this);

    this.start = start;
    this.addTask = addTask;

    // inherit from event emitter
    EventEmitter.call(this);
}

require('util').inherits(ParallelExec, EventEmitter);

module.exports = ParallelExec;
