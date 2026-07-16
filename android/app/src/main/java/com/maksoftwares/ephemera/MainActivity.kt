package com.maksoftwares.ephemera

import android.Manifest
import android.app.AlertDialog
import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import java.lang.ref.WeakReference

class MainActivity : AppCompatActivity() {
    companion object {
        private const val APP_URL = "https://appassets.androidplatform.net/assets/www/index.html"
        private var current: WeakReference<MainActivity>? = null

        fun dispatchNativeCallAction(action: String) {
            current?.get()?.runNativeCallAction(action)
        }
    }

    private lateinit var webView: WebView
    private var pageReady = false
    private var pendingCallAction: String? = null
    private var pendingWebPermission: PermissionRequest? = null
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null

    private val notificationPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        maybeOfferFullScreenCallPermission()
    }

    private val mediaPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        val request = pendingWebPermission ?: return@registerForActivityResult
        pendingWebPermission = null
        val allowedResources = request.resources.filter { resource ->
            when (resource) {
                PermissionRequest.RESOURCE_AUDIO_CAPTURE -> ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                PermissionRequest.RESOURCE_VIDEO_CAPTURE -> ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                else -> false
            }
        }.toTypedArray()
        if (allowedResources.isNotEmpty()) request.grant(allowedResources) else request.deny()
    }

    private val filePickerLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val callback = fileChooserCallback ?: return@registerForActivityResult
        fileChooserCallback = null
        callback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        current = WeakReference(this)
        NativeCallNotifications.createChannels(this)

        webView = WebView(this)
        setContentView(webView, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        configureWebView()
        requestNotificationPermission()

        pendingCallAction = intent.getStringExtra(NativeCallNotifications.EXTRA_CALL_ACTION)
        if (savedInstanceState == null) webView.loadUrl(APP_URL) else webView.restoreState(savedInstanceState)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript(
                    """
                    (() => {
                      const incoming = document.getElementById('incomingModal');
                      if (incoming && !incoming.classList.contains('hidden')) { document.getElementById('declineCall')?.click(); return true; }
                      const people = document.getElementById('peoplePanel');
                      if (people?.classList.contains('open')) { document.getElementById('peopleClose')?.click(); return true; }
                      const viewer = document.querySelector('.media-viewer:not(.hidden)');
                      if (viewer) { history.back(); return true; }
                      return false;
                    })()
                    """.trimIndent(),
                ) { handled ->
                    if (handled != "true") {
                        if (webView.canGoBack()) webView.goBack() else finish()
                    }
                }
            }
        })
    }

    private fun configureWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = true
            javaScriptCanOpenWindowsAutomatically = false
        }
        webView.addJavascriptInterface(AndroidBridge(), "EphemeraAndroid")
        webView.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: android.webkit.WebResourceRequest) =
                assetLoader.shouldInterceptRequest(request.url)

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                pageReady = true
                pendingCallAction?.let {
                    pendingCallAction = null
                    runNativeCallAction(it)
                }
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val required = mutableListOf<String>()
                    if (request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) && ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                        required += Manifest.permission.RECORD_AUDIO
                    }
                    if (request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE) && ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                        required += Manifest.permission.CAMERA
                    }
                    if (required.isEmpty()) {
                        request.grant(request.resources.filter {
                            it == PermissionRequest.RESOURCE_AUDIO_CAPTURE || it == PermissionRequest.RESOURCE_VIDEO_CAPTURE
                        }.toTypedArray())
                    } else {
                        pendingWebPermission?.deny()
                        pendingWebPermission = request
                        mediaPermissionLauncher.launch(required.distinct().toTypedArray())
                    }
                }
            }

            override fun onShowFileChooser(webView: WebView?, filePathCallback: ValueCallback<Array<Uri>>, fileChooserParams: FileChooserParams): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback
                return try {
                    filePickerLauncher.launch(fileChooserParams.createIntent())
                    true
                } catch (_: ActivityNotFoundException) {
                    fileChooserCallback = null
                    false
                }
            }
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            maybeOfferFullScreenCallPermission()
        }
    }

    private fun maybeOfferFullScreenCallPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.canUseFullScreenIntent()) return
        AlertDialog.Builder(this)
            .setTitle("Allow full-screen call alerts")
            .setMessage("Android needs this permission to show an incoming Ephemera call over the lock screen, similar to a phone or WhatsApp call.")
            .setNegativeButton("Not now", null)
            .setPositiveButton("Open settings") { _, _ ->
                startActivity(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
                    data = Uri.parse("package:$packageName")
                })
            }
            .show()
    }

    fun runNativeCallAction(action: String) {
        if (!::webView.isInitialized || !pageReady) {
            pendingCallAction = action
            return
        }
        val safeAction = if (action == "answer") "answer" else "decline"
        runOnUiThread {
            webView.evaluateJavascript("window.__ephemeraNativeCallAction?.('$safeAction')", null)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.getStringExtra(NativeCallNotifications.EXTRA_CALL_ACTION)?.let(::runNativeCallAction)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        pendingWebPermission?.deny()
        fileChooserCallback?.onReceiveValue(null)
        if (isFinishing) {
            stopService(Intent(this, ConnectionService::class.java))
            webView.destroy()
        }
        if (current?.get() === this) current = null
        super.onDestroy()
    }

    inner class AndroidBridge {
        @JavascriptInterface
        fun showIncomingCall(caller: String, callType: String) {
            runOnUiThread { NativeCallNotifications.showIncomingCall(this@MainActivity, caller, callType) }
        }

        @JavascriptInterface
        fun dismissIncomingCall() {
            runOnUiThread { NativeCallNotifications.dismiss(this@MainActivity) }
        }

        @JavascriptInterface
        fun setRoomActive(active: Boolean) {
            val intent = Intent(this@MainActivity, ConnectionService::class.java).setAction(
                if (active) ConnectionService.ACTION_START else ConnectionService.ACTION_STOP,
            )
            if (active) ContextCompat.startForegroundService(this@MainActivity, intent) else stopService(intent)
        }
    }
}
