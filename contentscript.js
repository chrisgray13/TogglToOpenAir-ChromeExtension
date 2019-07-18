var errors;
var errorCount;
function setError(msg) {
    for (let i = 1; i < arguments.length; i++) {
        if (i === 1) {
            msg += " " + arguments[i].toString();
        } else {
            msg += ", " + arguments[i].toString();
        }
    }

    errors += "\n- " + msg;
    errorCount++;

    console.log("ERROR: " + msg);
}

(function addListeners() {
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        errors = "";
        errorCount = 0;

        if (request.action === "loading") {
            let bodyElement = document.getElementsByTagName("body")[0];
            bodyElement.innerHTML = bodyElement.innerHTML +
                "<div id='loadingImage' style='background: #3F3F3F;width: 100%;height: 100%;position: absolute;top: 0px;left: 0px;z-index: 10000;opacity: .8;text-align: center;'><span style='font-size: 20em;color: #000000;padding: 20px;'>Loading</span></div>";

            sendResponse({ success: true });
        } else if (request.action === "loadTimesheetData") {
            createTimesheet(request.data);

            sendResponse({
                success: errorCount === 0,
                message: errors,
                numberOfErrors: errorCount
            });
        } else if (request.action === "getStartDate") {
            let startDateString;
            let dateRange = document.getElementById("timesheet_data_range");
            if (dateRange) {
                let datePieces = dateRange.textContent.trim().split(" ");
                if (datePieces.length === 3) {
                    let dayPieces = datePieces[1].split("-");
                    if (dayPieces.length === 2) {
                        let startDate = new Date(datePieces[0] + " " + dayPieces[0] + " " + datePieces[2]);
                        startDateString = startDate.toISOString().substring(0, 10);
                    }
                } else if (datePieces.length === 6) {
                    let startDate = new Date(datePieces[0] + " " + datePieces[1] + " " + datePieces[5]);
                    startDateString = startDate.toISOString().substring(0, 10);
                } else {
                    setError("Unable to determine default start date");                    
                }
            }

            sendResponse({
                success: errorCount === 0,
                message: errors,
                numberOfErrors: errorCount,
                startDate: startDateString
            });
        } else if (request.action === "getProjects") {
            sendResponse({
                success: errorCount === 0,
                message: errors,
                numberOfErrors: errorCount,
                projects: getProjects()
            });
        }
    });
})();

function roundDuration(duration) {
    let roundDecimal = function (value, precision) {
        return Math.floor(value * (10 ^ precision)) / (10 ^ precision);
    };

    let overage = duration % 0.25000;
    if (overage >= 0.125000) {
        return roundDecimal(duration + (0.25000 - overage), 2);
    } else {
        return roundDecimal(duration - overage, 2);
    }
}

function getDay(date) {
    return new Date(date).getUTCDate();
}

function getDayOfTheWeek(date, sundayPosition) {
    if (sundayPosition < 1 || sundayPosition > 7) {
        setError("Bad usage of sundayPosition in getDateOfTheWeek");
    } else {
        let weekday = new Date(date).getUTCDay() // Sunday = 0
        weekday = weekday + sundayPosition
        if (weekday > 7) {
            weekday = weekday - 7
        }

        return weekday
    }
}

function getNumberOfTimeEntries() {
    let lastRow = document.querySelector("tr.gridDataEmptyRow select");
    return lastRow === undefined ? 0 : parseInt(lastRow.id.slice(7)) - 1;
}

var timesheetElements = {
    projects: "ts_c1_r",
    tasks: "ts_c2_r",
    timetype: "ts_c3_r"
};

function createTimesheet(timesheetData) {
    let row = getNumberOfTimeEntries() + 1;

    for (let projectTaskKey in timesheetData) {
        let projectTaskEntries = timesheetData[projectTaskKey];
        let dateEntry = undefined;
        for (let dateKey in projectTaskEntries) {
            dateEntry = projectTaskEntries[dateKey];
            let roundedDuration = roundDuration(dateEntry.dur);
            if (roundedDuration <= 0.0) {
                console.log("Skipping => ", dateEntry.start, dateEntry.client, dateEntry.project, dateEntry.description);
            } else {
                addHours(row, getDayOfTheWeek(dateEntry.start, 7), getDay(dateEntry.start), roundedDuration, dateEntry.description.replace("'", "\\'"));
            }
        }

        setTaskInfo(row, dateEntry.client, dateEntry.project, dateEntry.is_billable);
        row = row + 1;
    }

    let loadingImageElement = document.getElementById("loadingImage");
    if (loadingImageElement) {
        loadingImageElement.remove();
    }
}

function selectOptionForControl(selectCtrl, optionValue) {
    let matchingElement;

    for (let i = 0, optionsLength = selectCtrl.options.length; i < optionsLength; i++) {
        if (selectCtrl.options[i].textContent.indexOf(optionValue) > -1) {
            selectCtrl.selectedIndex = i;
            matchingElement = selectCtrl.options[i];
            break;
        }
    }

    return matchingElement;
}

function setTaskInfo(row, project, task, isBillable) {
    let selectOption = function (selectId, selectValue) {
        let selected = false;
        let selectCtrl = document.getElementById(selectId);
        if (selectCtrl) {
            // let xpath = "//option[contains(text(), '" + selectValue + "')]";
            // let matchingElement = document.evaluate(xpath, selectCtrl, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            let matchingElement = selectOptionForControl(selectCtrl, selectValue);

            if (matchingElement) {
                matchingElement.selected = true;
                console.log("Here is the option found => ", selectId, selectValue, matchingElement.textContent, matchingElement.value);
                if ("createEvent" in document) {
                    var evt = document.createEvent("HTMLEvents");
                    if (evt) {
                        evt.initEvent("change", true, false);
                        selected = selectCtrl.dispatchEvent(evt);
                    }
                } else if ("fireEvent" in selectCtrl) {
                    selectCtrl.fireEvent("onchange");
                } else {
                    console.log("Not sure how to call change on this select => ", selectId, selectValue);
                }
            } else {
                console.log("Could not find specific option for control => ", selectId, selectValue);
            }
        } else {
            console.log("Could not find control => ", selectId);
        }

        return selected;
    };

    console.log("Setting project and task on row => ", project, task, row);

    // Used to find tasks that are labeled Billable
    // E.g. Billable task, billable task, my task - billable, my task [Billable]
    let reg = new RegExp(/\W*billable\W*/i);
    let skipTask = false;

    // Set the Project
    let mappedProject = mapProject(project);
    if (mappedProject) {
        if (!selectOption(timesheetElements.projects + row, mappedProject)) {
            if (!selectOption(timesheetElements.projects + row, project)) {
                setError("Unable to set project on row " + row + " for " + project);
                skipTask = true;
            }
        }
    } else if (project) {
        if (!selectOption(timesheetElements.projects + row, project)) {
            setError("Unable to set project on row " + row + " for " + project);
            skipTask = true;
        }
    } else {
        setError("Project missing for row ", row);

        return;
    }

    // Set the Task - If using isBillable, do not strip billable
    if (!skipTask) {
        if (task) {
            let strippedTask = isBillable ? task : task.replace(reg, "");
            if (!selectOption(timesheetElements.tasks + row, strippedTask)) {
                strippedTask = stripTask(strippedTask);
                if (strippedTask) {
                    if (!selectOption(timesheetElements.tasks + row, strippedTask)) {
                        setError("Unable to set task on row " + row + " for " + strippedTask);
                    }
                } else {
                    setError("Unable to set task on row " + row + " for " + task);
                }
            }
        } else {
            setError("Task misssing for row ", row);

            return;
        }
    }

    // Set the Time type
    if (!selectOption(timesheetElements.timetype + row, (isBillable || reg.test(task)) ? "Billable Time" : "Non-Billable")) {
        setError("Unable to set time type on row ", row);
    }
}

// This is in support of the original project names from the first export
function mapProject(project) {
    if (project === "Advanced Solutions") {
        return "R&D - Advanced Solutions";
    } else if (project === "Oracle Cloud") {
        return "R&D - RFS for Oracle Cloud"
    } else {
        return undefined;
    }
}

// This is in support of the original task names from the first export
function stripTask(strippedTask) {
    let taskParts = strippedTask.split(" - ");

    if (taskParts.length === 1) {
        return undefined;
    } else {
        taskParts.shift();

        return taskParts.join(" - ");
    }
}

function addHours(row, dayOfWeek, day, hours, description) {
    let hoursAdded = false;
    let dateColumn = dayOfWeek + 3;

    let setDescription = function () {
        let descSet = false;

        // Pop the modal
        let noteCtrl = document.getElementById("ts_notes_c" + dateColumn + "_r" + row);
        if (noteCtrl) {
            noteCtrl.click();
            // Set the description
            let descCtrl = document.getElementById("tm_desc");
            if (descCtrl) {
                descCtrl.value = description;

                // Click the OK button
                let okBtn = document.querySelector(".btn-oa.dialogOkButton");
                if (okBtn) {
                    okBtn.click();
                    descSet = true;
                }
            }
        }
        
        if (!descSet) {
            setError("Unable to set the description for (row, dayOfWeek, day, hours, description) => ", row, dayOfWeek, day, hours, description);
        }
    };

    let dateHeaderCtrl = document.querySelector("th.timesheetFixedColumn" + (11 - dateColumn) + " span.monthDay");
    if (dateHeaderCtrl.textContent == day) {
        let hoursCtrl = document.getElementById("ts_c" + dateColumn + "_r" + row);
        if (hoursCtrl) {
            hoursCtrl.value = hours;
            if ("createEvent" in document) {
                var evt = document.createEvent("HTMLEvents");
                if (evt) {
                    evt.initEvent("change", true, false);
                    if (hoursCtrl.dispatchEvent(evt)) {
                        hoursAdded = true;
                        setDescription();
                    }
                }
            } else if ("fireEvent" in hoursCtrl) {
                hoursCtrl.fireEvent("onchange");
                hoursAdded = true;
                setDescription();
            }
        }
    }
    
    if (!hoursAdded) {
        setError("Unable to add hours for (row, dayOfWeek, day, hours, description) => ", row, dayOfWeek, day, hours, description)
    }
}

function getProjects() {
    let timeEntriesLength = getNumberOfTimeEntries();
    let projects = [];

    for (let i = 1; i <= timeEntriesLength; i++) {
        let projectCtrl = document.getElementById(timesheetElements.projects + i);
        if (projectCtrl) {
            if (projectCtrl.selectedOptions && (projectCtrl.selectedOptions.length > 0)) {
                let project = projectCtrl.selectedOptions[0].innerText;
                let doesProjectExist = false;

                for (let j = 0; j < projects.length; j++) {
                    if (projects[j].name === project) {
                        doesProjectExist = true;
                        break;
                    }
                }

                if (!doesProjectExist) {
                    let taskCtrl = document.getElementById(timesheetElements.tasks + i);
                    if (taskCtrl) {
                        let tasks = [];
                        for (let k = 1; k < taskCtrl.options.length; k++) {
                            tasks.push({ name: taskCtrl.options[k].innerText });
                        }

                        let selectedTask = (taskCtrl.selectedOptions.length > 0) ? taskCtrl.selectedOptions[0].innerText : undefined;
                        if (selectedTask) {
                            let billableTypeCtrl = document.getElementById(timesheetElements.timetype + i);
                            if (billableTypeCtrl) {
                                let selectedBillableType = (billableTypeCtrl.selectedOptions.length > 0) ? billableTypeCtrl.selectedOptions[0].innerText : undefined;
                                if (selectedBillableType === "Billable Time") {
                                    tasks.push({ name: selectedTask + " [Billable]" });
                                } else {
                                    console.log("Unable to find selected billable type => " + i);
                                }
                            } else {
                                console.log("Unable to find billable type control => " + i);
                            }
                        } else {
                            console.log("Unable to find selected task => " + i);
                        }

                        projects.push({ name: project, tasks: tasks });
                    } else {
                        console.log("Unable to find task control => " + i);
                    }
                }
            } else {
                console.log("Project control does not have a selected option => " + i);
            }
        } else {
            console.log("Could not find project control => " + i);
        }
    }

    return projects;
}