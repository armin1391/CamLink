"use strict";

/*
========================================
تنظیمات اصلی
========================================
*/

// این شناسه باید در تمام دستگاه‌ها یکسان باشد.
// بهتر است آن را با یک شناسه تصادفی و غیرقابل حدس عوض کنی.
const OWNER_PEER_ID = "camlink-owner-armin-2026-private-01";


/*
========================================
متغیرها
========================================
*/

const $ = id => document.getElementById(id);

let peer = null;
let localStream = null;
let activeCall = null;

let role = null;
let incomingCall = null;


/*
========================================
وضعیت سایت
========================================
*/

function status(message) {
    $("globalStatus").textContent = message;
}


/*
========================================
نمایش پنل‌ها
========================================
*/

function show(panel) {

    $("home").classList.add("hidden");
    $("senderPanel").classList.add("hidden");
    $("viewerPanel").classList.add("hidden");

    panel.classList.remove("hidden");
}


/*
========================================
قطع ارتباط
========================================
*/

function resetPeer() {

    if (activeCall) {
        activeCall.close();
        activeCall = null;
    }

    if (incomingCall) {
        incomingCall.close();
        incomingCall = null;
    }

    if (peer) {
        peer.destroy();
        peer = null;
    }
}


/*
========================================
خاموش کردن دوربین
========================================
*/

function stopLocalMedia() {

    if (localStream) {

        localStream.getTracks().forEach(track => {
            track.stop();
        });

        localStream = null;
    }
}


/*
========================================
انتخاب حالت
========================================
*/

$("showSender").onclick = () => {

    role = "sender";

    show($("senderPanel"));

    status("رضایت خود را تأیید کنید.");
};


$("showViewer").onclick = () => {

    role = "viewer";

    show($("viewerPanel"));

    startViewer();
};


/*
========================================
بازگشت
========================================
*/

document.querySelectorAll("[data-back]").forEach(button => {

    button.onclick = () => {

        if (role === "sender") {
            stopSender();
        }

        if (role === "viewer") {
            stopViewer();
        }

        role = null;

        show($("home"));
    };

});


/*
========================================
تأیید رضایت
========================================
*/

$("consent").onchange = event => {

    $("startCamera").disabled = !event.target.checked;
};


/*
========================================
شروع ارسال تصویر
========================================
*/

$("startCamera").onclick = async () => {

    if (!$("consent").checked) return;

    $("startCamera").disabled = true;

    status("درخواست اجازه دوربین...");

    try {

        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("مرورگر از دوربین پشتیبانی نمی‌کند.");
        }

        // فقط دوربین؛ بدون میکروفون

        localStream = await navigator.mediaDevices.getUserMedia({

            audio: false,

            video: {
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }

        });

        $("senderActive").classList.remove("hidden");
        $("startCamera").classList.add("hidden");

        $("senderStatus").textContent =
            "در حال اتصال به بیننده...";

        peer = new Peer();

        peer.on("open", () => {

            status("در حال ارسال درخواست مشاهده...");

            // درخواست اتصال به شناسه ثابت بیننده

            activeCall = peer.call(
                OWNER_PEER_ID,
                localStream
            );

            if (!activeCall) {
                throw new Error("ارسال درخواست ناموفق بود.");
            }

            $("senderStatus").textContent =
                "در انتظار تأیید بیننده...";

            activeCall.on("close", () => {

                $("senderStatus").textContent =
                    "اتصال پایان یافت.";

                stopSender();
            });

            activeCall.on("error", () => {

                status("خطا در ارتباط با بیننده.");

                stopSender();
            });

        });

        peer.on("error", error => {

            status("خطای اتصال: " + error.type);

            stopSender();
        });

    } catch (error) {

        stopLocalMedia();

        $("senderActive").classList.add("hidden");

        $("startCamera").classList.remove("hidden");

        $("startCamera").disabled = false;

        status(error.message || "خطا در روشن‌کردن دوربین.");
    }

};


/*
========================================
توقف ارسال
========================================
*/

function stopSender() {

    resetPeer();

    stopLocalMedia();

    $("senderActive").classList.add("hidden");

    $("startCamera").classList.remove("hidden");

    $("startCamera").disabled = !$("consent").checked;

    status("ارسال تصویر متوقف شد.");
}

$("stopCamera").onclick = stopSender;


/*
========================================
شروع پنل بیننده
========================================
*/

function startViewer() {

    if (peer) {
        resetPeer();
    }

    $("pendingBox").classList.add("hidden");
    $("viewerActive").classList.add("hidden");

    $("viewerConnection").textContent =
        "در حال اتصال به پنل مشاهده...";

    peer = new Peer(OWNER_PEER_ID);

    peer.on("open", () => {

        $("viewerConnection").textContent =
            "پنل فعال است؛ منتظر درخواست دوربین...";

        status("آماده دریافت درخواست.");

    });


    /*
    دریافت درخواست فرستنده
    */

    peer.on("call", call => {

        if (incomingCall || activeCall) {
            call.close();
            return;
        }

        incomingCall = call;

        $("pendingBox").classList.remove("hidden");

        $("viewerConnection").textContent =
            "یک درخواست جدید دریافت شد.";

        status("درخواست جدید دوربین دریافت شد.");

    });


    peer.on("error", error => {

        $("viewerConnection").textContent =
            "خطای اتصال: " + error.type;

        status("خطا در اتصال پنل.");

    });

}


/*
========================================
تأیید درخواست
========================================
*/

$("approveRequest").onclick = () => {

    if (!incomingCall) return;

    const call = incomingCall;

    incomingCall = null;

    activeCall = call;

    // تأیید دریافت تصویر؛ بدون فعال‌کردن دوربین بیننده

    call.answer();

    $("pendingBox").classList.add("hidden");

    $("viewerActive").classList.remove("hidden");

    $("viewerStatus").textContent =
        "در حال دریافت تصویر...";

    call.on("stream", stream => {

        $("remoteVideo").srcObject = stream;

        $("viewerStatus").textContent =
            "تصویر زنده برقرار است.";

        status("تصویر با موفقیت دریافت شد.");

    });

    call.on("close", () => {

        $("remoteVideo").srcObject = null;

        $("viewerActive").classList.add("hidden");

        $("viewerStatus").textContent =
            "اتصال قطع شد.";

        activeCall = null;

        status("فرستنده اتصال را متوقف کرد.");

    });

    call.on("error", () => {

        $("viewerStatus").textContent =
            "خطا در دریافت تصویر.";

    });

};


/*
========================================
رد درخواست
========================================
*/

$("rejectRequest").onclick = () => {

    if (incomingCall) {
        incomingCall.close();
        incomingCall = null;
    }

    $("pendingBox").classList.add("hidden");

    $("viewerConnection").textContent =
        "درخواست رد شد.";

    status("درخواست رد شد.");

};


/*
========================================
قطع اتصال بیننده
========================================
*/

function stopViewer() {

    resetPeer();

    $("remoteVideo").srcObject = null;

    $("viewerActive").classList.add("hidden");

    $("pendingBox").classList.add("hidden");

    status("اتصال بیننده قطع شد.");
}

$("disconnectViewer").onclick = () => {

    stopViewer();

    // پنل بیننده دوباره آماده دریافت درخواست می‌شود.

    startViewer();
};


/*
========================================
خروج از صفحه
========================================
*/

window.addEventListener("beforeunload", () => {

    resetPeer();

    stopLocalMedia();

});
