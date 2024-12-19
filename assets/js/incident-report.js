function addEventRow() {
    const table = document.getElementById('Events-table');
    const row = table.insertRow(-1);
    const cell1 = row.insertCell(0);
    const cell2 = row.insertCell(1);
    const cell3 = row.insertCell(2); // Cell for the Remove button


    cell1.innerHTML = `<input type="time" name="event-time" placeholder="Time" required>`;
    cell2.innerHTML = `<textarea name="event-description" id="event-description" placeholder="Enter details..." required>`; 
    cell3.innerHTML = `<button type="button" class="remove-button" onclick="removeEventRow(this)">Remove</button>`; 
}

// Function to remove an event row
function removeEventRow(button) {
    const row = button.closest('tr');
    row.remove();
}

function addWitnessRow() {
    const table = document.getElementById('witness-table');
    const row = table.insertRow(-1);
    const cell1 = row.insertCell(0);
    const cell2 = row.insertCell(1);
    const cell3 = row.insertCell(2);
    const cell4 = row.insertCell(3); // Cell for the Remove button


    cell1.innerHTML = `<input type="text" name="witness-name" placeholder="Name" required>`;
    cell2.innerHTML = `<input type="text" name="witness-org" placeholder="Organization" required>`;
    cell3.innerHTML = `<input type="text" name="witness-contact" placeholder="Contact Number" required>`;
    cell4.innerHTML = `<button type="button" class="remove-button" onclick="removeWitnessRow(this)">Remove</button>`;
}

 // Function to remove a witness row
 function removeWitnessRow(button) {
    const row = button.closest('tr');
    row.remove();
}