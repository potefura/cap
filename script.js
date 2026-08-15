/*
 * script.js — Potefura Captcha 一体型モジュール
 * (自動グレーアウト解除検知・トークン検証・イベント重複防止機能付き)
 */
(function () {
  var API_BASE = 'https://verify.potefura.jp/captcha';

  window.showCaptcha = openCaptcha;

  // トークン検証用関数（HTML側から呼び出し可能）
  window.verifyCaptchaToken = function (sid, token) {
    var url = API_BASE + '/verify/' + encodeURIComponent(sid) + '?token=' + encodeURIComponent(token);
    return fetch(url)
      .then(function (r) {
        return r.json().then(function (data) {
          return { status: r.status, data: data };
        });
      });
  };

  function injectStyle() {
    if (document.getElementById('cap-style')) return;
    var css = ''
      + '.potefura-captcha-box{position:relative;margin-bottom:20px;padding:12px 12px 28px 12px;'
      + 'border:1px solid #e4e1ea;border-radius:8px;background:#f9f8fc;display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;box-sizing:border-box;min-height:56px;transition:all .3s ease;}'
      + '.potefura-captcha-box input[type=checkbox]{width:18px;height:18px;cursor:pointer;margin:0;}'
      + '.potefura-captcha-box label{margin:0;font-size:13px;color:#333;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif;}'
      + '.cap-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;'
      + 'background:rgba(28,26,46,.35);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);}'
      + '.cap-card{width:320px;padding:20px;border-radius:16px;'
      + 'background:rgba(255,255,255,.95);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);'
      + 'border:1px solid rgba(255,255,255,.5);box-shadow:0 20px 50px rgba(20,16,32,.35);'
      + 'font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif;}'
      + '.cap-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}'
      + '.cap-head h2{font-size:14px;font-weight:600;color:#1c1a2e;margin:0;}'
      + '.cap-x,.cap-refresh{width:28px;height:28px;border-radius:8px;border:1px solid rgba(28,26,46,.15);'
      + 'background:rgba(255,255,255,.7);cursor:pointer;display:flex;align-items:center;justify-content:center;color:#5f5c70;}'
      + '.cap-x:hover,.cap-refresh:hover{background:#fff;}'
      + '.cap-scene{position:relative;width:100%;aspect-ratio:320/180;border-radius:10px;overflow:hidden;background:#20182f;user-select:none;}'
      + '.cap-scene img{display:block;width:100%;height:100%;object-fit:cover;pointer-events:none;}'
      + '.cap-piece{position:absolute;top:0;cursor:grab;touch-action:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35));}'
      + '.cap-piece.dragging{cursor:grabbing;}'
      + '.cap-piece.settle{transition:left .35s cubic-bezier(.2,.8,.2,1);}'
      + '.cap-status{position:absolute;left:0;right:0;top:10px;text-align:center;font-size:12px;font-weight:600;'
      + 'padding:4px 10px;margin:0 auto;width:fit-content;border-radius:6px;color:#fff;opacity:0;'
      + 'transform:translateY(-4px);transition:opacity .2s ease,transform .2s ease;pointer-events:none;}'
      + '.cap-status.show{opacity:1;transform:translateY(0);}'
      + '.cap-status.ok{background:rgba(47,143,107,.92);}'
      + '.cap-status.fail{background:rgba(201,75,63,.92);}'
      + '.cap-status.err{background:rgba(90,90,100,.92);}'
      + '.cap-rail{position:relative;margin-top:14px;height:40px;background:rgba(238,236,245,.85);border-radius:8px;overflow:hidden;}'
      + '.cap-fill{position:absolute;top:0;left:0;bottom:0;width:0;background:#cfe8dd;}'
      + '.cap-fill.settle{transition:width .35s cubic-bezier(.2,.8,.2,1);}'
      + '.cap-label{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;color:#7d7a8c;pointer-events:none;}'
      + '.cap-handle{position:absolute;top:2px;left:2px;width:36px;height:36px;border-radius:7px;background:#fff;'
      + 'border:1px solid #e4e1ea;box-shadow:0 1px 2px rgba(28,26,46,.15);display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none;}'
      + '.cap-handle.dragging{cursor:grabbing;}'
      + '.cap-handle.settle{transition:left .35s cubic-bezier(.2,.8,.2,1);}'
      + '.cap-rail.ok .cap-fill{background:#cdeadd;} .cap-rail.ok .cap-handle{border-color:#2f8f6b;}'
      + '.cap-rail.fail .cap-fill{background:#f4d3ce;} .cap-rail.fail .cap-handle{border-color:#c94b3f;}'
      + '.cap-rail.locked .cap-handle{cursor:not-allowed;}'
      + '.cap-rail.shake{animation:cap-shake .35s ease;}'
      + '@keyframes cap-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(5px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}'
      + '.cap-hint{margin-top:10px;font-size:11px;color:#7d7a8c;text-align:center;}'
      + '.cap-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;background:rgba(20,16,32,.35);}';
    var style = document.createElement('style');
    style.id = 'cap-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function initWidget() {
    injectStyle();
    var container = document.getElementById('potefura-captcha');
    if (!container) return;

    container.innerHTML =
      '<div class="potefura-captcha-box" id="captchaBox">' +
        '<input type="checkbox" id="capCheck">' +
        '<label for="capCheck">私はロボットではありません</label>' +
        '<span style="position:absolute; bottom:6px; right:10px; font-size:10px; font-weight:bold; color:#888888; line-height:1; pointer-events:none; font-family:sans-serif;">Potefura Captcha</span>' +
      '</div>';

    var captchaBox = document.getElementById('captchaBox');
    var capCheck = document.getElementById('capCheck');

    // ★ 監視処理：チェックが消えた（未判定に戻った）時にグレーアウトを自動解除 ★
    setInterval(function () {
      if (!capCheck.checked && captchaBox.style.pointerEvents === 'none') {
        captchaBox.style.backgroundColor = '';
        captchaBox.style.borderColor = '';
        captchaBox.style.opacity = '';
        captchaBox.style.cursor = '';
        captchaBox.style.pointerEvents = '';
        capCheck.disabled = false;
      }
    }, 150);

    capCheck.addEventListener('click', function (e) {
      if (capCheck.disabled) {
        e.preventDefault();
        return false;
      }

      if (capCheck.checked) {
        capCheck.checked = false;
        openCaptcha();
      }
    });
  }

  function openCaptcha() {
    injectStyle();

    var oldOverlay = document.querySelector('.cap-overlay');
    if (oldOverlay) oldOverlay.remove();

    var overlay = document.createElement('div');
    overlay.className = 'cap-overlay';
    overlay.innerHTML =
      '<div class="cap-card">' +
        '<div class="cap-head"><h2>パズルを合わせてください</h2>' +
          '<div style="display:flex;gap:6px;">' +
            '<button type="button" class="cap-refresh" aria-label="更新">&#8635;</button>' +
            '<button type="button" class="cap-x" aria-label="閉じる">&times;</button>' +
          '</div>' +
        '</div>' +
        '<div class="cap-scene">' +
          '<img class="cap-bg" alt="">' +
          '<img class="cap-piece" alt="">' +
          '<div class="cap-status"></div>' +
          '<div class="cap-loading">読み込み中…</div>' +
        '</div>' +
        '<div class="cap-rail">' +
          '<div class="cap-fill"></div>' +
          '<div class="cap-label">スライドしてパズルを完成させる</div>' +
          '<div class="cap-handle">&#10148;</div>' +
        '</div>' +
        '<p class="cap-hint">ピースがぴったりはまる位置までドラッグしてください</p>' +
      '</div>';
    document.body.appendChild(overlay);

    var el = {
      overlay: overlay,
      bg: overlay.querySelector('.cap-bg'),
      piece: overlay.querySelector('.cap-piece'),
      scene: overlay.querySelector('.cap-scene'),
      status: overlay.querySelector('.cap-status'),
      loading: overlay.querySelector('.cap-loading'),
      rail: overlay.querySelector('.cap-rail'),
      fill: overlay.querySelector('.cap-fill'),
      label: overlay.querySelector('.cap-label'),
      handle: overlay.querySelector('.cap-handle'),
      hint: overlay.querySelector('.cap-hint'),
      refreshBtn: overlay.querySelector('.cap-refresh'),
      closeBtn: overlay.querySelector('.cap-x'),
    };

    var state = {
      dragging: false,
      locked: false,
      session: null,
      pieceRenderW: 0,
      railMax: 0
    };

    var cleanupListeners = null;

    var closeFn = function () {
      if (cleanupListeners) cleanupListeners();
      overlay.remove();
      document.dispatchEvent(new CustomEvent('captchaClose'));
    };

    el.closeBtn.addEventListener('click', closeFn);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeFn(); });
    el.refreshBtn.addEventListener('click', function () { start(el, state); });

    cleanupListeners = bindDrag(el, state, closeFn);
    start(el, state);
  }

  function setLoading(el, on) { el.loading.style.display = on ? 'flex' : 'none'; }
  function showStatus(el, kind, text) {
    el.status.textContent = text;
    el.status.classList.remove('ok', 'fail', 'err');
    el.status.classList.add('show', kind);
  }
  function hideStatus(el) { el.status.classList.remove('show'); }
  function scale(el, state) { return el.scene.getBoundingClientRect().width / state.session.canvas_w; }

  function positionPiece(el, state, px) {
    var sc = scale(el, state);
    el.piece.style.left = (px * sc) + 'px';
    el.piece.style.top = ((state.session.piece_y - 4) * sc) + 'px';
    el.piece.style.width = (state.pieceRenderW * sc) + 'px';
    el.piece.style.height = (state.pieceRenderW * sc) + 'px';
  }

  function start(el, state) {
    setLoading(el, true);
    hideStatus(el);
    state.locked = false;
    state.dragging = false;
    el.rail.classList.remove('ok', 'fail', 'locked', 'shake');
    el.handle.classList.remove('settle');
    el.fill.classList.remove('settle');
    el.handle.style.left = '2px';
    el.fill.style.width = '0px';
    el.label.textContent = 'スライドしてパズルを完成させる';

    fetch(API_BASE + '/start')
      .then(function (r) { if (!r.ok) throw new Error('start failed: ' + r.status); return r.json(); })
      .then(function (data) {
        var probe = new Image();
        probe.onload = function () {
          state.session = data;
          state.pieceRenderW = probe.naturalWidth;
          el.bg.src = data.image_large_url + '?t=' + Date.now();
          el.piece.src = data.image_small_url + '?t=' + Date.now();
          el.piece.onload = function () {
            state.railMax = el.rail.clientWidth - el.handle.offsetWidth - 4;
            positionPiece(el, state, 0);
            setLoading(el, false);
          };
        };
        probe.src = data.image_small_url + '?t=' + Date.now();
      })
      .catch(function (err) {
        setLoading(el, false);
        showStatus(el, 'err', 'サーバーに接続できません');
        el.hint.textContent = String(err.message || err);
      });
  }

  function bindDrag(el, state, closeFn) {
    var startClientX = 0, startLeft = 2;

    function down(clientX) {
      if (!state.session || state.locked) return;
      state.railMax = el.rail.clientWidth - el.handle.offsetWidth - 4;
      state.dragging = true;
      el.handle.classList.add('dragging');
      el.piece.classList.add('dragging');
      el.handle.classList.remove('settle');
      el.fill.classList.remove('settle');
      hideStatus(el);
      startClientX = clientX;
      startLeft = parseFloat(el.handle.style.left) || 2;
    }

    function move(clientX) {
      if (!state.dragging) return;
      var dx = clientX - startClientX;
      var newLeft = Math.min(Math.max(startLeft + dx, 2), state.railMax);
      el.handle.style.left = newLeft + 'px';
      el.fill.style.width = (newLeft + el.handle.offsetWidth / 2) + 'px';

      var frac = (newLeft - 2) / (state.railMax - 2);
      var travel = state.session.canvas_w - state.pieceRenderW;
      positionPiece(el, state, frac * travel);
      el.label.textContent = '';
    }

    function up() {
      if (!state.dragging) return;
      state.dragging = false;
      el.handle.classList.remove('dragging');
      el.piece.classList.remove('dragging');
      el.handle.classList.add('settle');
      el.fill.classList.add('settle');

      var newLeft = parseFloat(el.handle.style.left) || 2;
      var frac = (newLeft - 2) / (state.railMax - 2);
      var travel = state.session.canvas_w - state.pieceRenderW;
      var xForServer = Math.round(frac * travel);

      state.locked = true;
      el.rail.classList.add('locked');

      var url = API_BASE + '/solved/' + state.session.id + '/' + encodeURIComponent(xForServer);

      fetch(url)
        .then(function (r) { return r.json().then(function (d) { return { status: r.status, data: d }; }); })
        .then(function (res) {
          if (res.status === 409) {
            showStatus(el, 'err', 'この認証はすでに使用済みです');
            return;
          }

          if (res.data && res.data.success) {
            el.rail.classList.add('ok');
            showStatus(el, 'ok', '認証に成功しました');

            var captchaBox = document.getElementById('captchaBox');
            var capCheck = document.getElementById('capCheck');

            if (capCheck) {
              capCheck.checked = true;
              capCheck.disabled = true;
            }
            if (captchaBox) {
              captchaBox.style.backgroundColor = '#eef0f2';
              captchaBox.style.borderColor = '#d1d5db';
              captchaBox.style.opacity = '0.65';
              captchaBox.style.cursor = 'not-allowed';
              captchaBox.style.pointerEvents = 'none';
            }

            console.log('[CAPTCHA SUCCESS]', { id: state.session.id, token: res.data.token });
            
            document.dispatchEvent(new CustomEvent('captchaSuccess', {
              detail: { id: state.session.id, token: res.data.token }
            }));

            setTimeout(function () {
              closeFn();
            }, 500);
          } else {
            var diffStr = (res.data && typeof res.data.diff !== 'undefined') ? ' (誤差: ' + res.data.diff + 'px)' : '';
            el.rail.classList.add('fail', 'shake');
            showStatus(el, 'fail', '位置が合いませんでした' + diffStr);
            setTimeout(function () {
              el.rail.classList.remove('shake');
              state.locked = false;
              el.rail.classList.remove('locked');
            }, 380);
          }
        })
        .catch(function (err) {
          showStatus(el, 'err', '通信エラーが発生しました');
          console.error(err);
          state.locked = false;
          el.rail.classList.remove('locked');
        });
    }

    var onMouseMove = function (e) { move(e.clientX); };
    var onMouseUp = function () { up(); };
    var onTouchMove = function (e) { if (state.dragging) { move(e.touches[0].clientX); e.preventDefault(); } };
    var onTouchEnd = function () { up(); };

    el.handle.addEventListener('mousedown', function (e) { down(e.clientX); e.preventDefault(); });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    el.handle.addEventListener('touchstart', function (e) { down(e.touches[0].clientX); }, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);

    return function cleanup() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
