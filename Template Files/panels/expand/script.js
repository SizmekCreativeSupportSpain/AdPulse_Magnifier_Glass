var expansionDiv;
var closeButton;
var imageContainer;

/*******************
INITIALIZATION
*******************/
function checkIfAdKitReady(event) {
	adkit.onReady(initializeCreative);
}

function initializeCreative(event) {

	//Workaround (from QB6573) for Async EB Load where Modernizr isn't properly initialized
	typeof Modernizr === "object" && (Modernizr.touch = Modernizr.touch || "ontouchstart" in window);
	expansionDiv = document.getElementById("expansion");
	closeButton = document.getElementById("closeButton");
	imageContainer = document.getElementById('imageContainer');

	closeButton.addEventListener("click", handleCloseButtonClick);
	imageContainer.addEventListener('mouseenter', onMouseEnter);
	imageContainer.addEventListener('mouseleave', onMouseLeave);

}

function handleCloseButtonClick(e){
	adkit.collapse({
     panelName: "expand",
     actionType: adkit.ActionType.USER,
     animate: {
        clip: "rect(0, 100%, 0, 100%)",
        duration: 300,
        easing: adkit.Animation.Easing.EASE_IN,
        opacity: 0,
        init: {
           clip: "rect(0, 100%, 100%, 0)",
           opacity: 1
        }
     }
   });
}

window.addEventListener("load", checkIfAdKitReady);


function onMouseEnter(event){
	imageContainer.removeEventListener('mouseenter', onMouseEnter);
	imageContainer.addEventListener('mousemove', onMouseMove);
	imageContainer.addEventListener('click', function(){
		imageContainer.style.display = 'none';
		document.getElementById('imageContainerExp').style.opacity = '1';
	});
}
function onMouseMove(event){
	event.target.style.webkitMaskImage = 'radial-gradient(circle 100px at ' + event.pageX + 'px ' + event.pageY + 'px, rgba(255,255,255,1) 80%, rgba(255,255,255,0) 100%)';
	event.target.style.cursor = 'none';
}
function onMouseLeave(event){
	imageContainer.addEventListener('mouseenter',onMouseEnter);
	imageContainer.removeEventListener('mousemove', onMouseMove);
}
