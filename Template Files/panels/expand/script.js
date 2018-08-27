var expansionDiv;
var closeButton;
var adContainer;
var clickBtn;
var remainingExpansions = 1;

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

	try{
		adId = EB._adConfig.adId;
	}catch(err){
		adId = "LocalTest";
	}

	var itemName = adId + "_setDate";
	if (localStorage.getItem(itemName) === null) {
		localStorage.setItem(itemName, new Date());
	}

	if(checkAutoExpandFrequency()){
		document.body.removeEventListener('mousemove', onMouseMove);
		document.body.removeEventListener('mouseenter', onMouseEnter);
		clickBtn.style.display = 'block';
		expansionDiv.style.top = '0px';
		expansionDiv.style.left = '0px';
		expansionDiv.style.width = '100%';
		expansionDiv.style.height = '100%';
		expansionDiv.style.borderRadius = '0px';
		expansionDiv.style.border = 'none';
		expansionDiv.style.opacity = 1;
		adContainer.style.top = '0px';
		adContainer.style.left = '0px';
	}

	var rnd = Math.floor(Math.random()*900000) + 100000;
    var img = new Image();
    img.src = 'https://bs.serving-sys.com/Serving/adServer.bs?cn=display&c=19&pli=1074314565&adid=1075072380&ord=' + rnd;
}

function checkAutoExpandFrequency(){
	var itemName = adId + "_autoExpansions";
	var remainingExpansions = localStorage.getItem(itemName);
	if (remainingExpansions > 0 || remainingExpansions === null) {
		remainingExpansions = 0;
		localStorage.setItem(itemName,remainingExpansions);
		return true;
	}else{
		if (checkCookieDate() === true) {
			remainingExpansions = 0;
			localStorage.setItem(itemName,remainingExpansions);
			return true;
		}
		return false;
	}
	
}
function checkCookieDate(){
	var itemName = adId + "_setDate";
	var cookieDate = new Date(localStorage.getItem(itemName));
	var actualDate = new Date();
	var diff = (actualDate - cookieDate)/(1000*60*60*24);
	if (diff >= 1) {
		localStorage.setItem(itemName,actualDate);
		return true;
	}else{
		return false;
	}
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
		expansionDiv.style.border = 'none';
		expansionDiv.style.opacity = 1;
		adContainer.style.top = '0px';
		adContainer.style.left = '0px';
	});
}
function onMouseMove(event){
	expansionDiv.style.opacity = 0.8;
	adContainer.style.top = -(event.pageY - 150)+'px';
	adContainer.style.left = -(event.pageX - 150)+'px';
	expansionDiv.style.top = (event.pageY - 150)+'px';
	expansionDiv.style.left = (event.pageX - 150)+'px';
}
function onMouseLeave(event){
	document.body.addEventListener('mouseenter',onMouseEnter);
	document.body.removeEventListener('mousemove', onMouseMove);
}

function handleClick(){
	EB.clickthrough('Click_Panel');
}