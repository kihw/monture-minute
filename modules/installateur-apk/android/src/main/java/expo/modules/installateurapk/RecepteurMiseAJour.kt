package expo.modules.installateurapk

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build

/**
 * Reçu par la nouvelle version juste après une mise à jour. Android a fermé l'app et ne peut pas la
 * rouvrir seul (lancements en arrière-plan bloqués) : une notification « touche pour rouvrir » le
 * fait d'un geste. Elle disparaît dès que l'app est rouverte (InstallateurApkModule.OnCreate).
 */
class RecepteurMiseAJour : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) {
      return
    }
    val ouvrir = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
    val gestionnaire = context.getSystemService(NotificationManager::class.java) ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      gestionnaire.createNotificationChannel(
        NotificationChannel(CANAL, "Mises à jour", NotificationManager.IMPORTANCE_DEFAULT)
      )
    }
    val version =
      try {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName
      } catch (_: PackageManager.NameNotFoundException) {
        null
      }
    val notification =
      (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(context, CANAL) else @Suppress("DEPRECATION") Notification.Builder(context))
        .setSmallIcon(context.applicationInfo.icon)
        .setContentTitle(if (version != null) "Monture Minute $version installée" else "Mise à jour installée")
        .setContentText("Touche pour rouvrir l’app.")
        .setAutoCancel(true)
        .setContentIntent(
          PendingIntent.getActivity(
            context,
            0,
            ouvrir.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
          )
        )
        .build()
    gestionnaire.notify(ID_NOTIFICATION, notification)
  }

  companion object {
    const val CANAL = "mises-a-jour"
    const val ID_NOTIFICATION = 7301
  }
}
