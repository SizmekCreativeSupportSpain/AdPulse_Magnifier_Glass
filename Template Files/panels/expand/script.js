var expansionDiv;
var closeButton;
var adContainer;
var clickBtn;

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
	adContainer = document.getElementById('adContainer');
	clickBtn = document.getElementById('clickBtn');

	closeButton.addEventListener("click", handleCloseButtonClick);
	clickBtn.addEventListener("click", handleClick);
	document.body.addEventListener('mouseenter', onMouseEnter);
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
	document.body.removeEventListener('mouseenter', onMouseEnter);
	document.body.addEventListener('mousemove', onMouseMove);
	document.body.addEventListener('click', function(){
		document.body.removeEventListener('mousemove', onMouseMove);
		clickBtn.style.display = 'block';
		expansionDiv.style.top = '0px';
		expansionDiv.style.left = '0px';
		expansionDiv.style.width = '100%';
		expansionDiv.style.height = '100%';
		expansionDiv.style.borderRadius = '0px';
		adContainer.style.top = '0px';
		adContainer.style.left = '0px';
	});
}
function onMouseMove(event){
	expansionDiv.style.opacity = 1;
	adContainer.style.top = -(event.pageY - 75)+'px';
	adContainer.style.left = -(event.pageX - 75)+'px';
	expansionDiv.style.top = (event.pageY - 75)+'px';
	expansionDiv.style.left = (event.pageX - 75)+'px';
}
function onMouseLeave(event){
	document.body.addEventListener('mouseenter',onMouseEnter);
	document.body.removeEventListener('mousemove', onMouseMove);
}

function handleClick(){
	EB.clickthrough('Click_Panel');
}