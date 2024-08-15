// Handle 'Sell Your Soul' form submission
document.getElementById('soul-form').addEventListener('submit', function (event) {
    event.preventDefault(); // Prevent form submission
    const soulValue = document.getElementById('soul-value').value;
    console.log('Selling soul with value:', soulValue);
    sendMessage("sell_soul",soulValue)
    // Add logic to handle soul selling here
});

// Handle 'Transfer Funds' form submission
document.getElementById('transfer-form').addEventListener('submit', function (event) {
    event.preventDefault(); // Prevent form submission
    const transferTo = document.getElementById('transfer-to').value;
    const transferAmount = document.getElementById('transfer-amount').value;
    console.log(`Transferring ${transferAmount} to ${transferTo}`);
    message = {
        amount: transferAmount,
        destinary: transferTo
    }
    sendMessage("transfer", message)
    // Add logic to handle fund transfer here
});

// Handle 'Manage Account' form submission
document.getElementById('manage-username').addEventListener('submit', function (event) {
    event.preventDefault(); // Prevent form submission
    const accountusername = document.getElementById('account-username').value;
    sendMessage("change_username",accountusername)
    document.cookie = `username=${accountusername};path=/`;
    // Add logic to handle account management here
});

// Optionally, you could add code to dynamically update balance and social credits
// For example, you might fetch these from a server and update the DOM
// Create a new WebSocket connection
const ws = new WebSocket('ws://localhost:8080');

// Event handler for when the WebSocket connection is established
ws.onopen = () => {
    console.log('Connected to the WebSocket server');
    sendMessage("balance_check","")
};

// Event handler for when a message is received from the WebSocket server
ws.onmessage = (event) => {

    const data = JSON.parse(event.data);
    if(data.type == "update_balance"){
        document.getElementById("balance-amount").innerHTML= "$"+data.message ;
        document.getElementById('warning-message').classList.add('hidden');
    }
    if(data.type == "invalid_transaction"){
        const warningMessage = document.getElementById('warning-message');
        warningMessage.textContent = 'Invalid transaction. Please check the details and try again.';
        warningMessage.classList.remove('hidden');
    }
};

function sendMessage(type,content) {
    // Create a message object
    const message = {
        type: type,
        message: content,
        user: getCookie("username")
    };

    // Send the message as a JSON string
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        console.log(message)
    } else {
        console.error('WebSocket is not open. Unable to send message.');
    }
}

const getCookie = (name) => {
    return document.cookie.split('; ').reduce((r, v) => {
      const parts = v.split('=')
      return parts[0] === name ? decodeURIComponent(parts[1]) : r
    }, '')
  }
