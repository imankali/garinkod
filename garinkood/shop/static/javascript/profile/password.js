document.addEventListener('DOMContentLoaded', function () {
    // فعال‌سازی چشم رمز عبور
    const toggleButtons = document.querySelectorAll('.password-toggle');

    toggleButtons.forEach(btn => {
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);

        if (input) {
            btn.addEventListener('click', function () {
                if (input.type === 'password') {
                    input.type = 'text';
                    btn.textContent = '🔒';
                } else {
                    input.type = 'password';
                    btn.textContent = '👁️';
                }
            });
        }
    });

    // اعتبارسنجی تطبیق رمز عبور
    const pass1 = document.getElementById('id_password');
    const pass2 = document.getElementById('id_password2');
    const msg = document.getElementById('password-match-message');
    const submitBtn = document.getElementById('submit-btn');

    if (pass1 && pass2 && msg && submitBtn) {
        const check = () => {
            const p1 = pass1.value;
            const p2 = pass2.value;

            if (p1 === '' || p2 === '') {
                msg.classList.remove('show');
                submitBtn.disabled = true;
                return;
            }

            if (p1 !== p2) {
                msg.textContent = 'رمزهای عبور یکسان نیستند!';
                msg.classList.add('show');
                submitBtn.disabled = true;
            } else {
                msg.classList.remove('show');
                submitBtn.disabled = false;
            }
        };

        pass1.addEventListener('input', check);
        pass2.addEventListener('input', check);
    }
});