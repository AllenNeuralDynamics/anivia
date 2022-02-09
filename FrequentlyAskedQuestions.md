# Enabling Acess to Images using Absolute Path in MacOS
Web browsers have put constraints (for security reasons) on the local images that can be accessed by an offline html application. More details about these constraint is available [here](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS/Errors/CORSRequestNotHttp). For example, if your offline html application `via_image_annotator.html` file is opened from `/home/XYZ/via/via_image_annotator.html`, then it can access images `/home/XYZ/via/abc.jpg` or `/home/XYZ/via/dir/animage.jpg`.

Here is how you can allow your web browser to access files in local folder:

 * Mozilla Firefox (68.9.0+) : enter about:config in address bar and set `privacy.file_unique_origin = false`

 * Google Chrome (83.0.4103.106+) : close all existing Chrome browser windows and start the Chrome browser from command line with as follows: `/usr/bin/google-chrome-stable --allow-file-access-from-files`

This issue has been discussed by our users in [this thread](https://gitlab.com/vgg/via/-/issues/357#note_835506703) of our [issues portal](https://gitlab.com/vgg/via/-/issues/).
