// Ensure the script is loaded properly
console.log("incident-report.js loaded");

// Function to add a new row to the Events table
function addEventRow() {
    console.log("Add Event button clicked"); // Debugging log

    const table = document.getElementById("Events-table");

    if (!table) {
        console.error("Events table not found!");
        return;
    }

    const newRow = table.insertRow(-1);
    newRow.innerHTML = `
        <td><input type="time" name="event-time" required></td>
        <td><textarea name="event-description" required></textarea></td>
        <td><button type="button" class="remove-button" onclick="removeEventRow(this)">Remove</button></td>
    `;
}

// Function to remove an Event row
function removeEventRow(button) {
    const row = button.parentNode.parentNode;
    row.parentNode.removeChild(row);
    console.log("Event row removed");
}

// Function to add a new row to the Witness table
function addWitnessRow() {
    console.log("Add Witness button clicked"); // Debugging log

    const table = document.getElementById("witness-table");

    if (!table) {
        console.error("Witness table not found!");
        return;
    }

    const newRow = table.insertRow(-1);
    newRow.innerHTML = `
        <td><input type="text" name="witness-name" required></td>
        <td><input type="text" name="witness-org" required></td>
        <td><input type="text" name="witness-contact" required></td>
        <td><button type="button" class="remove-button" onclick="removeWitnessRow(this)">Remove</button></td>
    `;
}

// Function to remove a Witness row
function removeWitnessRow(button) {
    const row = button.parentNode.parentNode;
    row.parentNode.removeChild(row);
    console.log("Witness row removed");
}

// Ensure event listeners are properly assigned when the DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
    console.log("DOM fully loaded");

    // Get the buttons
    const addEventButton = document.getElementById("add-event-btn");
    const addWitnessButton = document.getElementById("add-witness-btn");

    if (addEventButton) {
        addEventButton.addEventListener("click", addEventRow);
        console.log("Event button listener added");
    } else {
        console.error("Add Event button not found");
    }

    if (addWitnessButton) {
        addWitnessButton.addEventListener("click", addWitnessRow);
        console.log("Witness button listener added");
    } else {
        console.error("Add Witness button not found");
    }
});


//load incident types
function loadIncidentTypes() {
    $.ajax({
        url: "http://192.168.1.142:3000/type_incidents",
        type: "GET",
        dataType: "json",
        success: function(data) {
            let dropdown = $("#type-of-incident");
            dropdown.empty(); // Clear existing options
            dropdown.append('<option value="">Select an Incident</option>');

            $.each(data, function(index, name) {
                dropdown.append(`<option value="${name}">${name}</option>`);
            });
        },
        error: function() {
            alert("Failed to load incident types.");
        }
    });
}

$(document).ready(function() {
    loadIncidentTypes();

    // Ensure the form properly detects the selected value before submission
    $("form").on("submit", function(e) {
        let selectedValue = $("#type-of-incident").val();
        console.log("Selected Incident:", selectedValue); // Debugging

        if (!selectedValue) {
            alert("Please select an incident from the list.");
            e.preventDefault(); // Stop form submission
        }
    });
});

// Refresh dropdown every 5 seconds to get newly added incidents
// setInterval(loadIncidentTypes, 5000);
