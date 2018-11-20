var billboardDiv,clickBtn;

/*******************
INITIALIZATION
*******************/
function checkIfAdKitReady(event) {
	adkit.onReady(initializeCreative);
}

function initializeCreative(event) {
	//Workaround (from QB6573) for Async EB Load where Modernizr isn't properly initialized
	typeof Modernizr === "object" && (Modernizr.touch = Modernizr.touch || "ontouchstart" in window);

	billboardDiv = document.getElementById("billboard");
	clickBtn = document.getElementById("clickBtn");

	clickBtn.addEventListener('click',function(){
		EB.clickthrough();
	});
}

window.addEventListener("load", checkIfAdKitReady);