import { El, Bus } from "./uzu.js";

function App () {
    const bus = Bus({
        status: 'editing',
        totalSeconds: 0,
        pauseStartTime: 0,
        pauseElapsedMs: 0,
        elapsedSeconds: 0,
        startTime: 0,
        time: {hours: 0, minutes: 0, seconds: 0},
    });
    const form = Form(bus);
    const wrapper = El('div', {
        style: {
            padding: "1.5rem 1rem",
            margin: "0 auto",
            maxWidth: "22rem",
            fontFamily: "Helvetica, sans-serif",
            color: "white",
        },
    }, [
        Title('⏱️ No-Nonsense Countdown Timer'),
        form.el,
    ]);
    return wrapper;
}

function Title (text) {
    return El('h1', {
        style: {
            fontSize: '1.2rem',
        }
    }, [text]);
}

function Form (bus) {
    // Text displaying countdown timer formatted as HH:MM:SS
    const formattedTimeEl = El('p', {
        style: {
            fontSize: '3rem',
            margin: '2rem 0',
        }
    }, [
        formatTime(bus.vals.totalSeconds),
    ]);

    // Text indicating the timer finished
    const completedText = El('p', {
        style: {
            display: 'none',
        }
    }, ['Timer complete']);

    // Default style for all buttons
    const btnStyle = {
        display: 'block',
        cursor: 'pointer',
        marginTop: '0.5rem',
        color: 'white',
        padding: '0.5rem 1rem',
        fontSize: '0.8rem',
        fontWeight: '800',
        border: '2px solid #666',
        background: '#444',
    };
    const startBtn = El('button', {
        on: { click: start, },
        style: btnStyle,
    }, ['Start']);
    const resetBtn = El('button', {
        on: { click: reset, },
        style: Object.assign(btnStyle, {
            display: 'none',
        }),
    }, ['Reset']);
    const pauseBtn = El('button', {
        style: Object.assign(btnStyle, {
            display: 'none',
        }),
        on: { click: pause }
    }, ['Pause']);
    const form = El('form', {
        on: {
            input: (ev) => {
                // Change the time values
                const time = formToTime(formToObj(ev.currentTarget));
                bus.pub('time', time);
                bus.pub('totalSeconds', timeToTotal(time));
            },
            submit: (ev) => {
                ev.preventDefault();
            },
        }
    }, [
        El('label', {
            style: {
                color: "#aaa",
                marginBottom: "0.5rem",
                display: "block",
            },
        }, ['Countdown from:']),
        TimeInput('hours', 'Hours',),
        TimeInput('minutes', 'Minutes',),
        TimeInput('seconds', 'Seconds'),
    ]);
    const el = El('div', {}, [
        form,
        El('div', {
            style: {
                display: 'flex',
                gap: '0.5rem',
            }
        }, [
            startBtn,
            pauseBtn,
            resetBtn,
        ]),
        formattedTimeEl,
        completedText,
    ]);

    // Style properties for enabling a button
    function enableBtnStyle (btn) {
        btn.style.cursor = 'pointer';
        btn.style.background = '#444';
        btn.style.border = '2px solid green';
        btn.style.color = 'white';
    }

    // Style properties for disabling a button
    function disableBtnStyle (btn) {
        btn.style.cursor = 'default';
        btn.style.background = '#333';
        btn.style.color = '#999';
        btn.style.border = '2px solid #222';
    }

    // Start timer
    function start () {
        if (timeIsValid(bus.vals.time)) {
            if (bus.vals.status !== 'paused') {
                // Reset the start time only if we are not paused
                bus.pub('startTime', (new Date()).getTime());
            }
            bus.pub('status', 'running');
            worker.postMessage('start');
        } else {
            console.log("Time invalid");
        }
    }

    // Reset timer
    function reset () {
        bus.pub('status', 'editing');
        bus.pub('totalSeconds', timeToTotal(bus.vals.time));
        bus.pub('elapsedSeconds', 0);
        worker.postMessage('stop');
    }

    // Pause timer
    function pause () {
        bus.pub('status', 'paused');
        bus.pub('pauseStartTime', (new Date()).getTime());
    }

    disableBtnStyle(startBtn);
    bus.sub('time', (time) => {
        if (timeIsValid(time)) {
            enableBtnStyle(startBtn);
        } else {
            disableBtnStyle(startBtn);
        }
    });

    bus.sub('status', status => {
        const fields = form.querySelectorAll('input');
        // Disable all form fields when timer is running/paused/finished
        if (status === 'editing') {
            fields.forEach(f => {
                f.disabled = false;
            });
        } else {
            fields.forEach(f => {
                f.disabled = true;
            });
        }
        // Change button states based on status
        if (status === 'running') {
            startBtn.style.display = 'none';
            pauseBtn.style.display = 'block';
            resetBtn.style.display = 'block';
        } else if (status === 'finished') {
            startBtn.style.display = 'none';
            pauseBtn.style.display = 'none';
            resetBtn.style.display = 'block';
        } else if (status === 'paused') {
            startBtn.style.display = 'block';
            pauseBtn.style.display = 'none';
            resetBtn.style.display = 'block';
        } else {
            startBtn.style.display = 'block';
            pauseBtn.style.display = 'none';
            resetBtn.style.display = 'none';
        }
        // Show/hide completed text based on status
        if (status === 'finished') {
            completedText.style.display = 'block';
        } else {
            completedText.style.display = 'none';
        }
    });

    // Change countdown time text based on total and elapsed seconds
    bus.sub('totalSeconds', totalSeconds => {
        formattedTimeEl.textContent = formatTime(totalSeconds);
    });
    bus.sub('elapsedSeconds', elapsedSeconds => {
        formattedTimeEl.textContent = formatTime(bus.vals.totalSeconds - elapsedSeconds);
    });

    const worker = new Worker("timer.js");
    worker.addEventListener("message", (ev) => {
        if (bus.vals.status === 'running') {
            const delta = ev.data - bus.vals.startTime - bus.vals.pauseElapsedMs;
            const seconds = Math.floor(delta / 1000);
            if (seconds > bus.vals.elapsedSeconds) {
                bus.pub('elapsedSeconds', seconds);
            }
            if (seconds >= bus.vals.totalSeconds) {
                bus.pub('status', 'finished');
                worker.postMessage('stop');
                synthBeep();
            }
        } else if (bus.vals.status === 'paused') {
            const delta = ev.data - bus.vals.pauseStartTime;
            bus.pub('pauseElapsedMs', delta);
        }
    });

    return { el, bus };
}

function TimeInput (name, placeholder) {
    return El('input', {
        style: {
            width: '3.5rem',
        },
        props: {
            name,
            value: null,
            placeholder,
        },
    });
}

function formToObj (form) {
    const formData = new FormData(form);
    const ret = {};
    formData.forEach((val, label) => {
        ret[label] = val;
    });
    return ret;
}

function formToTime (formData) {
    const time = {};
    for (const key in formData) {
        if (!formData[key].match(/\d+/)) {
            time[key] = 0;
        } else {
            time[key] = Number(formData[key]);
        }
    }
    return time;
}

function timeIsValid (time) {
    return time != null && (time.hours > 0 || time.minutes > 0 || time.seconds > 0);
}

function timeToTotal (time) {
    return time.hours * 3600 + time.minutes * 60 + time.seconds;
}

function formatTime (seconds) {
    const hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;
    const bits = [
        hours, minutes, seconds
    ].map(t => String(t).padStart(2, '0'));
    return bits.join(":");
}

function synthBeep () {
    const ctx = new AudioContext();
    function playNote (delay, length, freq) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        setTimeout(function () {
            osc.start(0);
        }, delay);
        setTimeout(function () {
            gain.gain.exponentialRampToValueAtTime(
                0.00001, ctx.currentTime + 0.04
            );
        }, delay + length);
    }
    playNote(0, 150, 800);
    playNote(151, 150, 1000);
    playNote(302, 150, 1200);
    playNote(453, 150, 1000);
    playNote(604, 150, 800);
}

window._app = App()
document.body.appendChild(window._app);

// Focus on input on pageload
document.querySelector('input').focus();
