window.addEventListener("beforeunload", function(event) {
      var form = document.getElementById("myForm");
      if (form.hasBeenSubmitted !== true) {
        event.preventDefault(); // جلوگیری از بسته شدن صفحه
        event.returnValue = ''; // برای نمایش پیام هشدار
      }
});

document.addEventListener("DOMContentLoaded", function() {
      var form = document.getElementById("myForm");
      form.addEventListener("submit", function(event) {
        form.hasBeenSubmitted = true; // نشان دادن اینکه فرم ارسال شده است
        // ارسال داده‌ها به سرور یا انجام عملیات دیگر
        console.log("Form submitted");
      });
});