
const yourModInitFunction = () => {
    setInterval(() => {
        console.error("<----<<  TEST YNAMP SCENARIO  >>---->");
    }, 2000);
}
// Add your function to the engine's ready event
engine.whenReady.then(yourModInitFunction);