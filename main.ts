// Set up radio communication
radio.setGroup(1);

const REQUEST_NUMBER_MSG = "REQUEST";
const ASSIGN_NUMBER_MSG = "ASSIGN";
const START_ANIMATION_MSG = "START";
const DISPLAY_COORDS_MSG = "DISPLAY_COORDS";
const CLEAR_SCREEN_MSG = "CLEAR_SCREEN"; // New message for clearing all screens

let screen_number = -1;
let number_of_screens = 1;
let isMaster = false;
let showNumber = true;

// Define an entity to represent the moving point with jumping mechanics
class Entity {
    x: number;
    y: number;
    direction: boolean;
    velocityY: number; // Controls vertical movement

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.direction = true; // Direction: true for right, false for left
        this.velocityY = 0; // No initial vertical movement
    }

    move() {
        // Horizontal movement
        if (this.direction) {
            if (this.x < 5 * number_of_screens - 1) {
                this.x++;
            } else {
                this.direction = false; // Change direction to left
                this.jump(); // Jump at the right edge
            }
        } else {
            if (this.x > 0) {
                this.x--;
            } else {
                this.direction = true; // Change direction to right
                this.jump(); // Jump at the left edge
            }
        }

        // Apply gravity and jumping mechanics
        this.y += this.velocityY;
        this.velocityY += 1; // Gravity effect

        // Bounce off the ground and ceiling
        if (this.y >= 4) {
            this.y = 4;
            this.velocityY = -2; // Bounce up when hitting the ground
        } else if (this.y <= 0) {
            this.y = 0;
            this.velocityY = 1; // Start falling down after reaching the top
        }
    }

    jump() {
        if (this.y === 4) { // Jump only if on the ground
            this.velocityY = -3; // Initial upward velocity
        }
    }
}

let entity = new Entity(0, 4); // Create the entity starting at position (0, 4)

// Function to map global coordinates to local coordinates based on the screen number
function mapToLocalCoordinates(globalX: number, globalY: number): { x: number, y: number } {
    let localX = globalX - 5 * screen_number;
    let localY = Math.min(4, Math.max(0, globalY)); // Constrain y between 0 and 4
    return { x: localX, y: localY };
}

// When button A is pressed, make this Micro:bit the master
input.onButtonPressed(Button.A, function () {
    if (screen_number === -1) {
        isMaster = true;
        screen_number = 0;
        basic.showNumber(screen_number);
    }
});

// Handle received radio messages
radio.onReceivedString(function (receivedMessage) {
    if (receivedMessage === REQUEST_NUMBER_MSG && isMaster) {
        radio.sendString(ASSIGN_NUMBER_MSG + number_of_screens);
        number_of_screens++;
    }

    if (receivedMessage.indexOf(ASSIGN_NUMBER_MSG) === 0 && screen_number === -1) {
        screen_number = parseInt(receivedMessage.substr(ASSIGN_NUMBER_MSG.length));
        basic.showNumber(screen_number);
    }

    // Start animation
    if (receivedMessage === START_ANIMATION_MSG) {
        showNumber = false;
        basic.clearScreen();
    }

    // Display coordinates on the respective screen
    if (receivedMessage.indexOf(DISPLAY_COORDS_MSG) === 0) {
        let coords = receivedMessage.substr(DISPLAY_COORDS_MSG.length);
        let [x, y] = coords.split(",").map(val => parseInt(val, 10));

        // Map global coordinates to local coordinates
        const localCoords = mapToLocalCoordinates(x, y);

        // Check if the mapped coordinates are valid (0-4)
        if (localCoords.x >= 0 && localCoords.x <= 4 && localCoords.y >= 0 && localCoords.y <= 4) {
            led.plot(localCoords.x, localCoords.y); // Plot the point
        }
    }

    // Clear the screen on all devices
    if (receivedMessage === CLEAR_SCREEN_MSG) {
        basic.clearScreen();
    }
});

// Slaves request screen number if they don't have one
basic.forever(function () {
    if (screen_number === -1) {
        radio.sendString(REQUEST_NUMBER_MSG);
    }
    basic.pause(500);
});

// Master starts animation when button B is pressed
input.onButtonPressed(Button.B, function () {
    if (isMaster) {
        radio.sendString(START_ANIMATION_MSG);
        showNumber = false;
        basic.clearScreen();
        entity = new Entity(0, 4); // Reset position of the entity

        // Animate movement
        basic.forever(function () {
            // Send clear screen message to all devices before updating
            radio.sendString(CLEAR_SCREEN_MSG);

            // **Clear screen 0 explicitly** if it's the master, to ensure no trails
            if (screen_number === 0) {
                basic.clearScreen();
            }

            // Move the entity
            entity.move();

            // Send the entity's global coordinates to all screens
            let message = DISPLAY_COORDS_MSG + entity.x + "," + entity.y;
            radio.sendString(message);

            // Plot the entity only on the correct screen
            for (let i = 0; i < number_of_screens; i++) {
                const localCoords = mapToLocalCoordinates(entity.x, entity.y);

                if (screen_number === i) {
                    // Plot only on the correct screen
                    if (localCoords.x >= 0 && localCoords.x <= 4 && localCoords.y >= 0 && localCoords.y <= 4) {
                        led.plot(localCoords.x, localCoords.y);
                    }
                }
            }

            basic.pause(200); // Wait 200ms before updating the position again
        });
    }
});
