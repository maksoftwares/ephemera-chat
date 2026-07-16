const nativeBridge = window.EphemeraAndroid;

if (nativeBridge) {
  const incomingModal = document.getElementById('incomingModal');
  let incomingVisible = false;

  function syncIncomingCall() {
    const visible = Boolean(incomingModal && !incomingModal.classList.contains('hidden'));
    if (visible && !incomingVisible) {
      const caller = document.getElementById('incomingTitle')?.textContent?.trim() || 'Ephemera participant';
      const callType = document.getElementById('incomingType')?.textContent?.trim() || 'Incoming call';
      try { nativeBridge.showIncomingCall(caller, callType); } catch {}
    } else if (!visible && incomingVisible) {
      try { nativeBridge.dismissIncomingCall(); } catch {}
    }
    incomingVisible = visible;
  }

  function syncRoomPresence() {
    const active = /^#\/room\/[^/]+\/[^/]+$/.test(location.hash);
    try { nativeBridge.setRoomActive(active); } catch {}
  }

  window.__ephemeraNativeCallAction = action => {
    if (action === 'answer') document.getElementById('acceptCall')?.click();
    if (action === 'decline') document.getElementById('declineCall')?.click();
  };

  if (incomingModal) {
    new MutationObserver(syncIncomingCall).observe(incomingModal, { attributes: true, attributeFilter: ['class'] });
  }
  addEventListener('hashchange', syncRoomPresence);
  addEventListener('beforeunload', () => {
    try { nativeBridge.dismissIncomingCall(); } catch {}
  });
  syncIncomingCall();
  syncRoomPresence();
}
