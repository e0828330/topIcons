// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;
const Main = imports.ui.main;
const Lang = imports.lang;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const Mainloop = imports.mainloop;
const NotificationDaemon = imports.ui.notificationDaemon;

let trayAddedId = 0;
let trayRemovedId = 0;
let getSource = null;
let icons = [];

function init() {
    getSource = Lang.bind(Main.notificationDaemon, NotificationDaemon.NotificationDaemon.prototype._getSource);
}

function enable() {
    moveToTop();
}

function createSource (title, pid, ndata, sender, trayIcon) { 
  if (trayIcon) {
    onTrayIconAdded(this, trayIcon, title);
    return null;
  }

  return getSource(title, pid, ndata, sender, trayIcon);
};

const TrayIndicator = new Lang.Class({
    Name: 'TrayIndicator',
    Extends: PanelMenu.Button,

    _init: function(icon){
        this.parent(0.0, _("Tray Indicator"));

        this._trayIcon = icon;
        this.actor.add_actor(icon);

        //this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
    },

    destroy: function() {
        this.parent();
    },

    getIcon: function() {
        return this._trayIcon;
    },

});

function onTrayIconAdded(o, icon) {

    let wmClass = icon.wm_class ? icon.wm_class.toLowerCase() : '';

    global.log('onTrayIconAdded: ' + wmClass); 

    if (NotificationDaemon.STANDARD_TRAY_ICON_IMPLEMENTATIONS[wmClass] !== undefined)
        return;

    icon.height = Panel.PANEL_ICON_SIZE;
    icon.width = Panel.PANEL_ICON_SIZE;

    let trayIndicator = new TrayIndicator(icon)

    icon.reactive = true;
    icon._clicked = icon.connect('button-release-event', function(actor, event) {
        icon.click(event);
    });

    if (icons[wmClass] != undefined) {
        let oldIndicator = icons[wmClass];
        icons[wmClass] = null;
        oldIndicator.destroy();
    }
    icons[wmClass] = trayIndicator;
    Main.panel.addToStatusArea('tray-' + wmClass, trayIndicator);
}

function onTrayIconRemoved(o, icon) {
    let wmClass = icon.wm_class ? icon.wm_class.toLowerCase() : '';
    let oldIndicator = null;

    global.log('onTrayIconRemoved: ' + wmClass); 

    if (icons[wmClass] !== undefined) {
        oldIndicator = icons[wmClass];
        icons[wmClass] = null;
        oldIndicator.destroy();
        return;
    }

    global.log("onTrayIconRemoved: indicator not found!");
}

function moveToTop() {
    Main.notificationDaemon._trayManager.disconnect(Main.notificationDaemon._trayIconAddedId);
    Main.notificationDaemon._trayManager.disconnect(Main.notificationDaemon._trayIconRemovedId);
    trayAddedId = Main.notificationDaemon._trayManager.connect('tray-icon-added', onTrayIconAdded);
    trayRemovedId = Main.notificationDaemon._trayManager.connect('tray-icon-removed', onTrayIconRemoved);

    Main.notificationDaemon._getSource = createSource;

    let toDestroy = [];
    for (let i = 0; i < Main.notificationDaemon._sources.length; i++) {
        let source = Main.notificationDaemon._sources[i];
        if (!source.trayIcon)
            continue;
        let parent = source.trayIcon.get_parent();
        parent.remove_actor(source.trayIcon);
        onTrayIconAdded(this, source.trayIcon);
        toDestroy.push(source);
    }

     for (let i = 0; i < toDestroy.length; i++) {
        toDestroy[i].destroy();
     }
}

function moveToTray() {
    if (trayAddedId != 0) {
        Main.notificationDaemon._trayManager.disconnect(trayAddedId);
        trayAddedId = 0;
    }

    if (trayRemovedId != 0) {
        Main.notificationDaemon._trayManager.disconnect(trayRemovedId);
        trayRemovedId = 0;
    }
    
    Main.notificationDaemon._trayIconAddedId = Main.notificationDaemon._trayManager.connect('tray-icon-added',
                                                Lang.bind(Main.notificationDaemon, Main.notificationDaemon._onTrayIconAdded));
    Main.notificationDaemon._trayIconRemovedId = Main.notificationDaemon._trayManager.connect('tray-icon-removed', 
                                                Lang.bind(Main.notificationDaemon, Main.notificationDaemon._onTrayIconRemoved));

    Main.notificationDaemon._getSource = getSource;

    for (var key in icons) {
        let indicator = icons[key];
        let icon = indicator.getIcon();
        icon.disconnect(icon._clicked);
        icon._clicked = undefined;
        indicator.actor.remove_actor(icon);
        indicator.destroy();
        Main.notificationDaemon._onTrayIconAdded(Main.notificationDaemon, icon);
    }
    
    icons = [];
}

function disable() {
    moveToTray();
}
