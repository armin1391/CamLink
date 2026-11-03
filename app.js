"use strict";

const $ = id => document.getElementById(id);

let peer = null;
let localStream = null;
let activeCall = null;

let role = null;


// ======================================
// وضعیت سایت
// ======================================

function status(message) {
    $("globalStatus").textContent = message;
}


// ======================================
// نمایش پنل‌ها
// ======================================

function show(panel) {

    $("home").classList.add("hidden");
    $("senderPanel").classList.add("hidden");
    $("viewerPanel").classList.add("hidden");

    panel.classList.remove("hidden");

}


// ======================================
// قطع ارتباط
// ======================================

function resetPeer() {

    if (activeCall) {
        activeCall.close();
        activeCall = null;
    }

    if (peer) {
        peer.destroy();
        peer = null;
    }

}


// ======================================
// خاموش کردن دوربین
// ======================================

function stopLocalMedia() {

    if (localStream) {

        localStream.getTracks().forEach(track => {
            track.stop();
        });

        localStream = null;
    }

    $("localVideo").srcObject = null;

}


// ======================================
// انتخاب حالت
// ======================================

$("showSender").onclick = () => {

    role = "sender";

    show($("senderPanel"));

    status("رضایت خود را تأیید کنید.");

};


$("showViewer").onclick = () => {

    role = "viewer";

    show($("viewerPanel"));

    status("کد اتصال را وارد کنید.");

};


// ======================================
// بازگشت
// ======================================

document.querySelectorAll("[data-back]").forEach(button => {

    button.onclick = () => {

        if (role === "sender" && localStream) {
            stopSender();
        }

        if (role === "viewer" && peer) {
            stopViewer();
        }

        role = null;

        show($("home"));

    };

});


// ======================================
// تأیید رضایت
// ======================================

$("consent").onchange = event => {

    $("startCamera").disabled = !event.target.checked;

};


// ======================================
// شروع ارسال تصویر
// ======================================

$("startCamera").onclick = async () => {

    if (!$("consent").checked) return;

    $("startCamera").disabled = true;

    status("درخواست اجازه دوربین...");

    try {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "مرورگر از دسترسی دوربین پشتیبانی نمی‌کند."
            );

        }


        // فقط دوربین؛ بدون میکروفون

        localStream =
            await navigator.mediaDevices.getUserMedia({

                audio: false,

                video: {

                    facingMode: "environment",

                    width: {
                        ideal: 1280
                    },

                    height: {
                        ideal: 720
                    }

                }

            });


        $("localVideo").srcObject = localStream;

        $("senderActive").classList.remove("hidden");

        $("startCamera").classList.add("hidden");


        $("senderStatus").textContent =
            "دوربین روشن است؛ منتظر بیننده...";


        peer = new Peer();


        // دریافت شناسه اتصال

        peer.on("open", id => {

            $("myCode").textContent = id;

            status("کد اتصال آماده است.");

        });


        // درخواست مشاهده تصویر

        peer.on("call", call => {

            const approved = confirm(
                "یک دستگاه درخواست مشاهده تصویر زنده دوربین شما را دارد. اجازه می‌دهید؟"
            );

            if (!approved) {

                call.close();

                $("senderStatus").textContent =
                    "درخواست رد شد.";

                return;

            }


            if (activeCall) {
                activeCall.close();
            }

            activeCall = call;

            call.answer(localStream);


            $("senderStatus").textContent =
                "تصویر برای بیننده تأییدشده ارسال می‌شود.";


            call.on("close", () => {

                if (activeCall === call) {
                    activeCall = null;
                }

                $("senderStatus").textContent =
                    "بیننده قطع شد.";

            });

        });


        peer.on("error", error => {

            status("خطای اتصال: " + error.type);

        });


    } catch (error) {

        stopLocalMedia();

        $("startCamera").classList.remove("hidden");

        $("startCamera").disabled = false;

        $("senderActive").classList.add("hidden");

        status(error.message);

    }

};


// ======================================
// کپی کد اتصال
// ======================================

$("copyCode").onclick = async () => {

    const code = $("myCode").textContent;

    if (!code || code === "---") return;

    try {

        await navigator.clipboard.writeText(code);

        status("کد کپی شد.");

    } catch {

        status("کد را دستی کپی کنید.");

    }

};


// ======================================
// توقف ارسال
// ======================================

function stopSender() {

    resetPeer();

    stopLocalMedia();

    $("senderActive").classList.add("hidden");

    $("startCamera").classList.remove("hidden");

    $("startCamera").disabled = true;

    $("consent").checked = false;

    $("myCode").textContent = "---";

    status("دوربین خاموش شد.");

}


$("stopCamera").onclick = stopSender;


// ======================================
// اتصال بیننده
// ======================================

$("connectViewer").onclick = () => {

    const remoteId = $("remoteCode").value.trim();

    if (!remoteId) {

        status("کد اتصال را وارد کنید.");

        return;

    }


    $("connectViewer").disabled = true;

    status("در حال اتصال...");


    peer = new Peer();


    peer.on("open", () => {

        // بیننده دوربین یا میکروفون خود را فعال نمی‌کند.
        // MediaStream خالی برای درخواست دریافت تصویر استفاده می‌شود.

        const call = peer.call(
            remoteId,
            new MediaStream()
        );

        if (!call) {

            status("ساخت درخواست اتصال ناموفق بود.");

            $("connectViewer").disabled = false;

            return;

        }


        activeCall = call;

        $("viewerActive").classList.remove("hidden");

        $("viewerStatus").textContent =
            "در انتظار تأیید صاحب دوربین...";


        call.on("stream", stream => {

            $("remoteVideo").srcObject = stream;

            $("viewerStatus").textContent =
                "تصویر زنده برقرار است.";

            $("connectViewer").classList.add("hidden");

            $("remoteCode").disabled = true;

            status("اتصال برقرار شد.");

        });


        call.on("close", () => {

            $("remoteVideo").srcObject = null;

            $("viewerStatus").textContent =
                "اتصال قطع شد.";

            $("connectViewer").classList.remove("hidden");

            $("remoteCode").disabled = false;

            activeCall = null;

        });


        call.on("error", () => {

            status("خطا در دریافت تصویر.");

            $("connectViewer").disabled = false;

        });

    });


    peer.on("error", error => {

        status("خطای اتصال: " + error.type);

        $("connectViewer").disabled = false;

    });

};


// ======================================
// قطع اتصال بیننده
// ======================================

function stopViewer() {

    resetPeer();

    $("remoteVideo").srcObject = null;

    $("viewerActive").classList.add("hidden");

    $("connectViewer").classList.remove("hidden");

    $("connectViewer").disabled = false;

    $("remoteCode").disabled = false;

    status("اتصال قطع شد.");

}


$("disconnectViewer").onclick = stopViewer;


// ======================================
// خروج از صفحه
// ======================================

window.addEventListener("beforeunload", () => {

    resetPeer();

    stopLocalMedia();

});
