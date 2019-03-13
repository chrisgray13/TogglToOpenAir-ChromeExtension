var errors;
function setError(msg) {
    for (let i = 1; i < arguments.length - 1; i++) {
        if (i === 1) {
            msg += " " + arguments[i].toString();
        } else {
            msg += ", " + arguments[i].toString();
        }
    }

    errors += "\n- " + msg;

    console.log(msg);
}

(function addListeners() {
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.action === "loading") {
            let bodyElement = document.getElementsByTagName("body")[0];
            bodyElement.innerHTML = bodyElement.innerHTML +
                "<div id='loadingImage' style='background: #3F3F3F;width: 100%;height: 100%;position: absolute;top: 0px;left: 0px;z-index: 10000;opacity: .8;text-align: center;'><span style='font-size: 20em;color: #000000;padding: 20px;'>Loading</span></div>";

            sendResponse({ success: true });
        } else if (request.action === "loadTimesheetData") {
            errors = "";

            createTimesheet(request.data);

            if (errors) {
                sendResponse({ success: false, message: errors });
            } else {
                sendResponse({ success: true });
            }
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
                }
            }
            sendResponse({
                success: true,
                startDate: startDateString
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

function createTimesheet(timesheetData) {
    let lastRow = document.querySelector("tr.gridDataEmptyRow select");
    let row = lastRow === undefined ? 1 : parseInt(lastRow.id.slice(7));

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

        setTaskInfo(row, dateEntry.client, dateEntry.project, "Non-Billable");
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

function setTaskInfo(row, project, task, timeType) {
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
                    setError("Not sure how to call change on this select => ", selectId, selectValue);
                }
            } else {
                setError("Could not find specific option for control => ", selectId, selectValue);
            }
        } else {
            setError("Could not find control => ", selectId);
        }

        if (!selected) {
            setError("Unable to set selection for (selectId, selectValue) => ",  selectId,  selectValue);
        }

        return selected;
    };

    console.log("Setting project and task on row => ", project, task, row);

    // Set the Project
    selectOption("ts_c1_r" + row, project);
    // Set the Task
    selectOption("ts_c2_r" + row, task);
    // Set the Time type
    selectOption("ts_c3_r" + row, timeType);
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