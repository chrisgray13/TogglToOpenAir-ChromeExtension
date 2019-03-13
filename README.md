# TogglToOpenAir-ChromeExtension
This is a Google Chrome Extension that provides a way to create a timesheet in OpenAir based on tracking data in Toggl

#### Pre-requisites:
This requires the following to be useful:
- [Toggl](https://toggl.com/) for tracking your time
- [OpenAir](https://www.openair.com/index.pl) for submitting a timesheet

#### To use:

###### Tracking time with Toggl:
1) Download [Toggl](https://toggl.com/)
2) Create or import Clients and Projects--synonymous with Projects and Tasks in OpenAir
    a. If purchased, use the billable feature in Toggl to mark projects as billable; otherwise, add "Billable" to Projects treat that time as billable, e.g. Billable Task, billable task, My Project - billable, My Project [Billable]
3) Start using Toggl to track time

###### Creating an OpenAir timesheet with Toggl data:
1) Go to [OpenAir](https://www.openair.com/index.pl)
2) Create a brand new timesheet
3) Click the TogglToOpenAir icon in the toolbar
4) Go to Toggl to get the Toggl API key--this can be found at the bottom of the [Toggl Profile](https://toggl.com/app/profile)
    a. Copy and paste the API key into the appropriate textbox in the Chrome Extension
5) Specify the start date--by default it is the start date of the new timesheet
6) Click the *Create* button
7) Review any errors and verify the results