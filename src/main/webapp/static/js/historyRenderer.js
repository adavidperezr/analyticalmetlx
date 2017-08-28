var intersectRect = function(r1, r2) {//Left,top,right,bottom
		if (typeof(r1) != "undefined" && typeof(r2) != "undefined"){
				return !(r2[0] > r1[2] ||
								 r2[2] < r1[0] ||
								 r2[1] > r1[3] ||
								 r2[3] < r1[1]);
		} else {
				return false;
		}
};
var overlapRect = function(r1,r2){
		if(!intersectRect(r1,r2)){
				return 0;
		}
		return (Math.max(r1[0], r2[0]) - Math.min(r1[2], r2[2])) * (Math.max(r1[1], r2[1]) - Math.min(r1[3], r2[3]));
};
var rectFromTwoPoints = function(pointA,pointB,minimumSideLength){
		minimumSideLength = minimumSideLength || 0;
		var topLeft = {x:0,y:0};
		var bottomRight = {x:0,y:0};
		if (pointA.x < pointB.x){
				topLeft.x = pointA.x;
				bottomRight.x = pointB.x;
		} else {
				topLeft.x = pointB.x;
				bottomRight.x = pointA.x;
		}
		if (pointA.y < pointB.y){
				topLeft.y = pointA.y;
				bottomRight.y = pointB.y;
		} else {
				topLeft.y = pointB.y;
				bottomRight.y = pointA.y;
		}
		var width = bottomRight.x - topLeft.x;
		var height = bottomRight.y - topLeft.y;
		if(width < minimumSideLength){
				bottomRight.x += minimumSideLength - width;
				width = bottomRight.x - topLeft.x;
		}
		if(height < minimumSideLength){
				bottomRight.y += minimumSideLength - height;
				height = bottomRight.y - topLeft.y;
		}
		return {
				left:topLeft.x,
				top:topLeft.y,
				right:bottomRight.x,
				bottom:bottomRight.y,
				width:width,
				height:height
		};
};

var createCanvasRenderer = function(canvasElem){
	var boardContext = canvasElem[0].getContext("2d");
	var boardContent = {};
	var pressureSimilarityThreshold = 32,
    viewboxX = 0,
    viewboxY = 0,
    viewboxWidth = 80,//why wouldnt this be device size
    viewboxHeight = 60,
    contentOffsetX = 0,
    contentOffsetY = 0,
    boardWidth = 0,
    boardHeight = 0;

	/* //not sure what these are yet!
	var visibleBounds = [];
	var renders = {};
	*/

	var boardLimit = 10000;

	var precision = Math.pow(10,3);
	var round = function(n){
			return Math.round(n * precision) / precision;
	};
	var calculateImageBounds = function(image){
			image.bounds = [image.x,image.y,image.x + image.width,image.y + image.height];
			return image;
	}
	var calculateVideoBounds = function(video){
			video.bounds = [video.x,video.y,video.x + video.width,video.y + video.height];
			return video;
	}

	var determineCanvasConstants = _.once(function(){
			var currentDevice = DeviceConfiguration.getCurrentDevice();
			var maxX = 32767;//2147483647;
			var maxY = 32767;//2147483647;
			if (currentDevice == "browser"){
					//      maxX = 500;
					//      maxY = 500;
			}
			else if (currentDevice == "iPad" ){
					maxX = 6144;
					maxY = 6144;
			} else if (currentDevice == "iPhone"){
					maxX = 2048;
					maxY = 2048;
			} else if (currentDevice == "IE9"){
					maxX = 8192;
					maxY = 8192;
			}
			return {x:maxX,y:maxY};
	});

	var determineScaling = function(inX,inY){
			var outputX = inX;
			var outputY = inY;
			var outputScaleX = 1.0;
			var outputScaleY = 1.0;
			var canvasConstants = determineCanvasConstants();
			var maxX = canvasConstants.x;
			var maxY = canvasConstants.y;
			if (inX > maxX){
					outputScaleX = maxX / inX;
					outputX = inX * outputScaleX;
					outputScaleY = outputScaleX;
					outputY = inY * outputScaleX;
			}
			if (outputY > maxY){
					outputScaleY = maxY / outputY;
					outputY = outputY * outputScaleY;
					outputScaleX = outputScaleY;
					outputX = outputX * outputScaleY;
			}
			var returnObj = {
					width:outputX,
					height:outputY,
					scaleX:outputScaleX,
					scaleY:outputScaleY
			};
			return returnObj;
	}

	var incorporateBoardBounds = function(bounds){
			if (!isNaN(bounds[0])){
					boardContent.minX = Math.min(boardContent.minX,bounds[0]);
			}
			if (!isNaN(bounds[1])){
					boardContent.minY = Math.min(boardContent.minY,bounds[1]);
			}
			if (!isNaN(bounds[2])){
					boardContent.maxX = Math.max(boardContent.maxX,bounds[2]);
			}
			if (!isNaN(bounds[3])){
					boardContent.maxY = Math.max(boardContent.maxY,bounds[3]);
			}
			boardContent.width = boardContent.maxX - boardContent.minX;
			boardContent.height = boardContent.maxY - boardContent.minY;
	}
	var mergeBounds = function(b1,b2){
			var b = {};
			b.minX = Math.min(b1[0],b2[0]);
			b.minY = Math.min(b1[1],b2[1]);
			b.maxX = Math.max(b1[2],b2[2]);
			b.maxY = Math.max(b1[3],b2[3]);
			b.width = b.maxX - b.minX;
			b.height = b.maxY - b.minY;
			b.centerX = b.minX + b.width / 2;
			b.centerY = b.minY + b.height / 2;
			b[0] = b.minX;
			b[1] = b.minY;
			b[2] = b.maxX;
			b[3] = b.maxY;
			return b;
	}
	var isUsable = function(element){
			var boundsOk = !(_.some(element.bounds,function(p){
					return isNaN(p);// || p > boardLimit || p < -boardLimit;
			}));
			var sizeOk = "size" in element? !isNaN(element.size) : true
			var textOk =  "text" in element? element.text.length > 0 : true;
			/*
			var myGroups = _.map(Conversations.getCurrentGroup(),"id");
			var forMyGroup = _.isEmpty(element.audiences) ||
					Conversations.isAuthor() ||
					_.some(element.audiences,function(audience){
							return audience.action == "whitelist" && _.includes(myGroups,audience.name);
					});

			var isMine = element.author == UserSettings.getUsername();
			var isDirectedToMe = _.some(element.audiences,function(audience){
					return audience.action == "direct" && audience.name == UserSettings.getUsername();
			});
			var availableToMe = isMine || isDirectedToMe;// || forMyGroup;
			return boundsOk && sizeOk && textOk && availableToMe;
			*/
			return boundsOk && sizeOk && textOk; //&& availableToMe;
	}

	var transformReceived = function(transform){
    var op = "";
    var transformBounds = (function(){
        var myBounds = [undefined,undefined,undefined,undefined]; //minX,minY,maxX,maxY
        var incBounds = function(bounds){
            var max = function(count){
							var reference = myBounds[count];
							if (reference != undefined && !isNaN(reference)){
								myBounds[count] = Math.max(reference,bounds[count]);
							} else {
								myBounds[count] = bounds[count];
							}
            };
            var min = function(count){
							var reference = myBounds[count];
							if (reference != undefined && !isNaN(reference)){
								myBounds[count] = Math.min(reference,bounds[count]);
							} else {
								myBounds[count] = bounds[count];
							}
            };
            min(0);
            min(1);
            max(2);
            max(3);
        };
        var getBounds = function(){
            return myBounds;
        };
        var incBoardBounds = function(){
            var thisBounds = getBounds();
            if (thisBounds[0] != undefined && thisBounds[1] != undefined && thisBounds[2] != undefined && thisBounds[3] != undefined){
                incorporateBoardBounds(thisBounds);
            }
        };
        var setMinX = function(input){
            safelySet(input,0);
        };
        var setMinY = function(input){
            safelySet(input,1);
        };
        var setMaxX = function(input){
            safelySet(input,2);
        };
        var setMaxY = function(input){
            safelySet(input,3);
        };
        var safelySet = function(input,reference){
            if (input != undefined && !isNaN(input)){
                myBounds[reference] = input;
            }
        };
        return {
            "minX":getBounds[0],
            "setMinX":setMinX,
            "minY":getBounds[1],
            "setMinY":setMinY,
            "maxX":getBounds[2],
            "setMaxX":setMaxX,
            "maxY":getBounds[3],
            "setMaxY":setMaxY,
            "incorporateBounds":incBounds,
            "getBounds":getBounds,
            "incorporateBoardBounds":incBoardBounds
        };
    })();
    if(transform.newPrivacy != "not_set" && !transform.isDeleted){
        var p = transform.newPrivacy;
        op += "Became "+p;
        var setPrivacy = function(ink){
            if(ink){
                ink.privacy = p;
            }
        };
        $.each(transform.inkIds,function(i,id){
            setPrivacy(boardContent.inks[id]);
            setPrivacy(boardContent.highlighters[id]);
        });
        $.each(transform.imageIds,function(i,id){
            boardContent.images[id].privacy = p;
        });
        $.each(transform.videoIds,function(i,id){
            boardContent.videos[id].privacy = p;
        });
        $.each(transform.textIds,function(i,id){
            boardContent.texts[id].privacy = p;
        });
        $.each(transform.multiWordTextIds,function(i,id){
            boardContent.multiWordTextIds[id].privacy = p;
        });
    }
    if(transform.isDeleted){
        op += "deleted";
        var p = transform.privacy;
        $.each(transform.inkIds,function(i,id){
            deleteInk("highlighters",p,id);
            deleteInk("inks",p,id);
        });
        $.each(transform.imageIds,function(i,id){
            deleteImage(p,id);
        });
        $.each(transform.videoIds,function(i,id){
            deleteVideo(p,id);
        });
        $.each(transform.textIds,function(i,id){
            deleteText(p,id);
        });
        $.each(transform.multiWordTextIds,function(i,id){
            deleteMultiWordText(p,id);
        });
    }
    if(transform.xScale != 1 || transform.yScale != 1){
        op += sprintf("scale (%s,%s)",transform.xScale,transform.yScale);
        var relevantInks = [];
        var relevantTexts = [];
        var relevantMultiWordTexts = [];
        var relevantImages = [];
        var relevantVideos = [];
        $.each(transform.inkIds,function(i,id){
            relevantInks.push(boardContent.inks[id]);
            relevantInks.push(boardContent.highlighters[id]);
        });
        $.each(transform.imageIds,function(i,id){
            relevantImages.push(boardContent.images[id]);
        });
        $.each(transform.videoIds,function(i,id){
            relevantVideos.push(boardContent.videos[id]);
        });
        $.each(transform.textIds,function(i,id){
            relevantTexts.push(boardContent.texts[id]);
        });
        $.each(transform.multiWordTextIds,function(i,id){
            if(id in Modes.text.echoesToDisregard) return;
            relevantMultiWordTexts.push(boardContent.multiWordTexts[id]);
        });
        var point = function(x,y){return {"x":x,"y":y};};
        var totalBounds = point(0,0);
        if ("xOrigin" in transform && "yOrigin" in transform){
            totalBounds.x = transform.xOrigin;
            totalBounds.y = transform.yOrigin;
        } else {
            var first = true;
            var updateRect = function(point){
                if (first){
                    totalBounds.x = point.x;
                    totalBounds.y = point.y;
                    first = false;
                } else {
                    if (point.x < totalBounds.x){
                        totalBounds.x = point.x;
                    }
                    if (point.y < totalBounds.y){
                        totalBounds.y = point.y;
                    }
                }
            };
            $.each(relevantInks,function(i,ink){
                if (ink != undefined && "bounds" in ink && _.size(ink.bounds) > 1){
                    updateRect(point(ink.bounds[0],ink.bounds[1]));
                }
            });
            $.each(relevantTexts,function(i,text){
                if (text != undefined && "x" in text && "y" in text){
                    updateRect(point(text.x,text.y));
                }
            });
            $.each(relevantMultiWordTexts,function(i,text){
                if (text != undefined && "x" in text && "y" in text){
                    updateRect(point(text.x,text.y));
                }
            });
            $.each(relevantImages,function(i,image){
                if (image != undefined && "x" in image && "y" in image){
                    updateRect(point(image.x,image.y));
                }
            });
            $.each(relevantVideos,function(i,video){
                if (video != undefined && "x" in video && "y" in video){
                    updateRect(point(video.x,video.y));
                }
            });
        }
        transformBounds.setMinX(totalBounds.x);
        transformBounds.setMinY(totalBounds.y);
        var transformInk = function(index,ink){
            if(ink && ink != undefined){
                var ps = ink.points;
                var xPos = ink.bounds[0];
                var yPos = ink.bounds[1];
                var xp, yp;

                var internalX = xPos - totalBounds.x;
                var internalY = yPos - totalBounds.y;
                var offsetX = -(internalX - (internalX * transform.xScale));
                var offsetY = -(internalY - (internalY * transform.yScale));

                for(var p = 0; p < ps.length; p += 3){
                    xp = ps[p] - xPos;
                    yp = ps[p + 1] - yPos;
                    ps[p] = (xPos + xp * transform.xScale) + offsetX;
                    ps[p+1] = (yPos + yp * transform.yScale) + offsetY;
                }
                calculateInkBounds(ink);
                transformBounds.incorporateBounds(ink.bounds);
            }
        };
        var transformImage = function(index,image){
            if (image != undefined){
                image.width = image.width * transform.xScale;
                image.height = image.height * transform.yScale;

                var internalX = image.x - totalBounds.x;
                var internalY = image.y - totalBounds.y;
                var offsetX = -(internalX - (internalX * transform.xScale));
                var offsetY = -(internalY - (internalY * transform.yScale));
                image.x = image.x + offsetX;
                image.y = image.y + offsetY;

                calculateImageBounds(image);
                transformBounds.incorporateBounds(image.bounds);
            }
        };
        var transformVideo = function(index,video){
            if (video != undefined){
                video.width = video.width * transform.xScale;
                video.height = video.height * transform.yScale;

                var internalX = video.x - totalBounds.x;
                var internalY = video.y - totalBounds.y;
                var offsetX = -(internalX - (internalX * transform.xScale));
                var offsetY = -(internalY - (internalY * transform.yScale));
                video.x = video.x + offsetX;
                video.y = video.y + offsetY;

                calculateVideoBounds(video);
                transformBounds.incorporateBounds(video.bounds);
            }
        };

        var transformText = function(index,text){
            if (text != undefined){
                text.width = text.width * transform.xScale;
                text.height = text.height * transform.yScale;

                var internalX = text.x - totalBounds.x;
                var internalY = text.y - totalBounds.y;
                var offsetX = -(internalX - (internalX * transform.xScale));
                var offsetY = -(internalY - (internalY * transform.yScale));
                text.x = text.x + offsetX;
                text.y = text.y + offsetY;

                text.size = text.size * transform.yScale;
                text.font = sprintf("%spx %s",text.size,text.family);
                if(isUsable(text)){
                    prerenderText(text);
                    calculateTextBounds(text);
                }
                else{
                    if(text.identity in boardContent.texts){
                        delete boardContent.texts[text.identity];
                    }
                }
                transformBounds.incorporateBounds(text.bounds);
            }
        };
        var transformMultiWordText = function(index,text){
            if (text != undefined){
                var newWidth = (text.width || text.requestedWidth) * transform.xScale;
                text.requestedWidth = newWidth;
                text.width = text.requestedWidth;
                text.doc.width(text.width);
                _.each(text.words,function(word){
                    word.size = word.size * transform.xScale;
                });

                var internalX = text.x - totalBounds.x;
                var internalY = text.y - totalBounds.y;

                var offsetX = -(internalX - (internalX * transform.xScale));
                var offsetY = -(internalY - (internalY * transform.yScale));
                text.doc.position = {x:text.x + offsetX,y:text.y + offsetY};
                text.doc.load(text.words);
                transformBounds.incorporateBounds(text.bounds);
            }
        };
        $.each(relevantInks,transformInk);
        $.each(relevantImages,transformImage);
        $.each(relevantVideos,transformVideo);
        $.each(relevantTexts,transformText);
        $.each(relevantMultiWordTexts,transformMultiWordText);
    }
    if(transform.xTranslate || transform.yTranslate){
        var deltaX = transform.xTranslate;
        var deltaY = transform.yTranslate;
        op += sprintf("translate (%s,%s)",deltaX,deltaY);
        var translateInk = function(ink){
            if(ink){
                var ps = ink.points;
                for(var p = 0; p < ps.length; p += 3){
                    ps[p] += deltaX;
                    ps[p+1] += deltaY;
                }
                calculateInkBounds(ink);
                transformBounds.incorporateBounds(ink.bounds);
            }
        }
        $.each(transform.inkIds,function(i,id){
            translateInk(boardContent.inks[id]);
            translateInk(boardContent.highlighters[id]);
        });
        $.each(transform.videoIds,function(i,id){
            var video = boardContent.videos[id];
            video.x += transform.xTranslate;
            video.y += transform.yTranslate;
            calculateVideoBounds(video);
            transformBounds.incorporateBounds(video.bounds);
        });
        $.each(transform.imageIds,function(i,id){
            var image = boardContent.images[id];
            image.x += transform.xTranslate;
            image.y += transform.yTranslate;
            calculateImageBounds(image);
            transformBounds.incorporateBounds(image.bounds);
        });
        $.each(transform.textIds,function(i,id){
            var text = boardContent.texts[id];
            text.x += transform.xTranslate;
            text.y += transform.yTranslate;
            calculateTextBounds(text);
            transformBounds.incorporateBounds(text.bounds);
        });
        $.each(transform.multiWordTextIds,function(i,id){
            if(id in Modes.text.echoesToDisregard) return;
            var text = boardContent.multiWordTexts[id];
            var doc = text.doc;
            doc.position.x += transform.xTranslate;
            doc.position.y += transform.yTranslate;
            text.x = doc.position.x;
            text.y = doc.position.y;
            text.doc.invalidateBounds();
            transformBounds.incorporateBounds(text.bounds);
        });
    }
    transformBounds.incorporateBoardBounds();
    updateStatus(sprintf("%s %s %s %s %s %s",
                         op,
                         transform.imageIds.length,
                         transform.textIds.length,
                         transform.multiWordTextIds.length,
                         transform.inkIds.length,
                         transform.videoIds.length));
    _.each(trackerFrom(transform.identity),function(tracker){
        updateTracking(tracker);
    });
    blit();
	}

	var addStanzaFunc = function(stanza){
		if (stanza !== undefined && "type" in stanza){
			switch (stanza.type) {
				case "moveDelta":
					transformReceived(stanza);
					break;
				case "ink":
					var ink = stanza;
					prerenderInk(ink,true);
					if (ink.isHighlighter){
						boardContent.highlighters[ink.identity] = stanza;
					} else {
						boardContent.inks[ink.identity] = stanza;
					}
					render();
					break;
				case "text":
					prerenderText(stanza,true);
					boardContent.texts[stanza.identity] = stanza;
					render();
					break;
				case "image":
					image.bounds = [image.x,image.y,image.x+image.width,image.y+image.height];
					incorporateBoardBounds(image.bounds);
					var dataImage = new Image();
					image.imageData = dataImage;
					var url = calculateImageSource(image,true);
					dataImage.onload = function(data){
						var shouldReCalcBounds = false;
						if (image.width == 0){
							image.width = dataImage.naturalWidth;
							shouldReCalcBounds = true;
						}
						if (image.height == 0){
							image.height = dataImage.naturalHeight;
							shouldReCalcBounds = true;
						}
						if (shouldReCalcBounds){
							image.bounds = [image.x,image.y,image.x+image.width,image.y+image.height];
							incorporateBoardBounds(image.bounds);
						}
						prerenderImage(image);
						boardContent.images[stanza.identity] = stanza;
						render();
					};
					dataImage.onError = function(error){
						passException(error,"preRenderHistory:imageDataLoad",[dataImage,image]);
					};
					dataImage.src = url;
					break;
				case "multiWordText":
					prerenderMultiwordText(stanza,true);
					boardContent.multiWordTexts[stanza.identity] = stanza;
					render();
					break;
				case "video":
					prerenderVideo(stanza,true);
					boardContent.videos[stanza.identity] = stanza;
					render();
					break;
				default:
					break;	
			}
			historyUpdated(boardContent);
		}
	};
	var prerenderInk = function(ink,onBoard){
			if(!isUsable(ink)){
					if(ink.identity in boardContent.inks){
							delete boardContent.inks[ink.identity];
					}
					if(ink.identity in boardContent.highlighters){
							delete boardContent.highlighters[ink.identity];
					}
					return false;
			}
			calculateInkBounds(ink);
			if(onBoard){
					incorporateBoardBounds(ink.bounds);
			}
			var isPrivate = ink.privacy.toUpperCase() == "PRIVATE";
			var rawWidth = ink.bounds[2] - ink.bounds[0] + (ink.thickness);
			var rawHeight = ink.bounds[3] - ink.bounds[1] + (ink.thickness);

			var scaleMeasurements = determineScaling(rawWidth,rawHeight);
			var canvas = $("<canvas />",{
					width:scaleMeasurements.width,
					height:scaleMeasurements.height
			})[0];
			ink.canvas = canvas;
			var context = canvas.getContext("2d");
			canvas.width = scaleMeasurements.width;
			canvas.height = scaleMeasurements.height;
			var rawPoints = ink.points;
			var points = [];
			var x,y,pr,p;
			for (p = 0; p < rawPoints.length; p += 3){
					points.push(rawPoints[p] * scaleMeasurements.scaleX);
					points.push(rawPoints[p + 1] * scaleMeasurements.scaleY);
					points.push(rawPoints[p + 2] / 256);
			}
			var contentOffsetX = -1 * ((ink.minX - ink.thickness / 2)) * scaleMeasurements.scaleX;
			var contentOffsetY = -1 * ((ink.minY - ink.thickness / 2)) * scaleMeasurements.scaleY;
			var scaledThickness = ink.thickness * scaleMeasurements.scaleX;
			if(isPrivate){
					x = points[0] + contentOffsetX;
					y = points[1] + contentOffsetY;
					context.lineWidth = scaledThickness;
					context.lineCap = "round";
					context.strokeStyle = "red";
					context.globalAlpha = 0.3;
					context.moveTo(x,y);
					for(p = 0; p < points.length; p += 3){
							context.beginPath();
							context.moveTo(x,y);
							x = points[p]+contentOffsetX;
							y = points[p+1]+contentOffsetY;
							pr = scaledThickness * points[p+2];
							context.lineWidth = pr + 2;
							context.lineTo(x,y);
							context.stroke();
					}
					context.globalAlpha = 1.0;
			}
			context.strokeStyle = ink.color[0];
			context.fillStyle = ink.color[0];
			x = points[0] + contentOffsetX;
			y = points[1] + contentOffsetY;

			context.beginPath();
			context.moveTo(x,y);
			pr = scaledThickness * points[2];
			context.arc(x,y,pr/2,0,2 * Math.PI);
			context.fill();
			context.lineCap = "round";
			for(p = 0; p < points.length; p += 3){
					context.beginPath();
					context.moveTo(x,y);
					x = points[p+0] + contentOffsetX;
					y = points[p+1] + contentOffsetY;
					pr = scaledThickness * points[p+2];
					context.lineWidth = pr;
					context.lineTo(x,y);
					context.stroke();
			}
			return true;
	}

	var urlEncodeSlideName = function(slideName){
			var newSlideName = btoa(slideName);
			return newSlideName;
	}
	var calculateImageSource = function(image){
			var slide = image.privacy.toUpperCase() == "PRIVATE" ? sprintf("%s%s",image.slide,image.author) : image.slide;
			return sprintf("/proxyImageUrl/%s?source=%s",urlEncodeSlideName(slide),encodeURIComponent(image.source.trim()));
	}
	var calculateVideoSource = function(video){
			var slide = video.privacy.toUpperCase() == "PRIVATE" ? sprintf("%s%s",video.slide,video.author) : video.slide;
			return sprintf("/videoProxy/%s/%s",urlEncodeSlideName(slide),encodeURIComponent(video.identity.trim()));
	}
	var calculateTextBounds = function(text){
			text.bounds = [text.x,text.y,text.x + text.width, text.y + (text.runs.length * text.size * 1.25)];
			return text;
	}
	var calculateInkBounds = function(ink){
			var minX = Infinity;
			var minY = Infinity;
			var maxX = -Infinity;
			var maxY = -Infinity;
			var widths = [];
			var points = ink.points;
			var hw = ink.thickness / 2;
			var hh = ink.thickness / 2;
			if(points.length == 6){
					minX = points[0] - hw;
					maxX = points[0] + hw;
					minY = points[1] - hh;
					maxY = points[1] + hh;
					widths.push(points[2]);
			}
			else{
					for(var cindex = 0; cindex < points.length; cindex += 3){
							var x = round(points[cindex]);
							var y = round(points[cindex+1]);
							points[cindex] = x;
							points[cindex+1] = y;
							widths.push(points[cindex+2]);
							minX = Math.min(x - hw,minX);
							minY = Math.min(y - hh,minY);
							maxX = Math.max(x + hw ,maxX);
							maxY = Math.max(y + hh,maxY);
					}
			}
			ink.minX = minX;
			ink.minY = minY;
			ink.maxX = maxX;
			ink.maxY = maxY;
			ink.width = maxX - minX;
			ink.height = maxY - minY;
			ink.centerX = minX + hw;
			ink.centerY = minY + hh;
			ink.bounds=[minX,minY,maxX,maxY];
			ink.widths=widths;
			return ink;
	}
	var scale = function(){
			return Math.min(boardWidth / viewboxWidth, boardHeight / viewboxHeight);
	}
	var prerenderMultiwordText = function(text){
		return; // will need to fix this
			var editor = Modes.text.editorFor(text).doc;
			editor.load(text.words);
			editor.updateCanvas();
			incorporateBoardBounds(text.bounds);
	}
	var prerenderImage = function(image) {
			var canvas = $("<canvas/>")[0];
			image.canvas = canvas;
			canvas.width = image.width;
			canvas.height = image.height;
			var borderW = canvas.width * 0.10;
			var borderH = canvas.height * 0.10;
			canvas.width = image.width + borderW;
			canvas.height = image.height + borderH;
			var context = canvas.getContext("2d");
			context.drawImage(image.imageData,borderW / 2,borderH / 2,image.width, image.height);
			if(image.privacy.toUpperCase() == "PRIVATE"){
					context.globalAlpha = 0.2;
					context.fillStyle = "red";
					context.fillRect(
							0,0,
							canvas.width,
							canvas.height);
					context.globalAlpha = 1.0;
			}
			delete image.imageData;
	}
	var prerenderVideo = function(video){
			if (!("video" in video)){
					var vid = $("<video/>",{
							src:calculateVideoSource(video)
					});
					video.video = vid[0];
					video.getState = function(){
							return {
									paused:vid[0].paused,
									ended:vid[0].ended,
									currentTime:vid[0].currentTime,
									duration:vid[0].duration,
									muted:vid[0].muted,
									volume:vid[0].volume,
									readyState:vid[0].readyState,
									played:vid[0].played,
									buffered:vid[0].buffered,
									playbackRate:vid[0].playbackRate,
									loop:vid[0].loop
							};
					};
					video.seek = function(newPosition){
							vid[0].currentTime = Math.min(vid[0].duration,Math.max(0,newPosition));
							if (vid[0].paused){
									video.play();
							}
					};
					video.muted = function(newState){
							if (newState != undefined){
									vid[0].muted = newState;
							}
							return vid[0].muted;
					};
					video.play = function(){
							var paintVideoFunc = function(){
									if (video.video.paused || video.video.ended){
											return false;
									} else {
											requestAnimationFrame(function(){
													blit();
													paintVideoFunc();
											});
											return true;
									}
							};
							video.video.addEventListener("play",function(){
									paintVideoFunc();
							},false);
							if (video.video.paused || video.video.ended){
									video.video.play();
							}
					};
					video.destroy = function(){
							video.video.removeAttribute("src");
							video.video.load();
					};
					video.pause = function(){
							if (!video.video.paused){
									video.video.pause();
							}
					};
			}
			if (!("bounds" in video)){
					calculateVideoBounds(video);
			}
	}
	var prerenderText = function(text){
			var canvas = $("<canvas />")[0];

			text.canvas = canvas;
			var context = canvas.getContext("2d");
			context.strokeStyle = text.color;
			context.font = text.font;
			var newline = /\n/;
			if(!text.width){
					text.width = Math.max.apply(Math,text.text.split(newline).map(
							function(subtext){
									return context.measureText(subtext).width;
							}));
			}
			var run = "";
			var yOffset = 0;
			var runs = [];
			var breaking = false;
			_.each(text.text.split(''),function(c,i){
					if(c.match(newline)){
							runs.push(""+run);
							run = "";
							return;
					}
					else if(breaking && c == " "){
							runs.push(run);
							run = "";
							return;
					}
					var w = context.measureText(run).width;
					breaking = w >= text.width - 80;
					run += c;
			});
			runs.push(run);
			runs = runs.map(function(r){
					return r.trim();
			});
			text.runs = runs;
			calculateTextBounds(text);
			var rawWidth = text.bounds[2] - text.bounds[0];
			var rawHeight = text.bounds[3] - text.bounds[1];
			var scaleMeasurements = determineScaling(rawWidth,rawHeight);
			canvas.width = scaleMeasurements.width;
			canvas.height = scaleMeasurements.height;

			text.height = rawHeight;
			if(text.privacy.toUpperCase() == "PRIVATE"){
					context.globalAlpha = 0.2;
					context.fillStyle = "red";
					context.fillRect(
							0,0,
							scaleMeasurements.width,
							scaleMeasurements.height);
					context.globalAlpha = 1.0;
			}
			context.fillStyle = text.color[0];
			context.textBaseline = "top";
			function generateTextFont(text) {
					var font = text.font;
					if(text.weight == "bold")
							font = font + ' bold';
					if(text.style == "italic")
							font = font + ' italic';

					return font;
			}

			_.each(text.runs,function(run,ri){
					var underline = function(){
							var lines = text.height/(text.size * 1.25);
							var range = _.range(text.size, text.height, text.height/lines);
							_.each(range, function(y){
									context.beginPath();
									context.strokeStyle = text.color[0];
									var underlineY = contentOffsetY + y;
									context.moveTo(contentOffsetX, underlineY);
									var underlineEndX = contentOffsetX + scaleMeasurements.width;
									context.lineTo(underlineEndX, underlineY);
									context.stroke();
							});
					};
					var _yOffset = ri * text.size * 1.25;
					context.font = generateTextFont(text);
					context.fillText(run,
													 contentOffsetX * scaleMeasurements.scaleX,
													 (contentOffsetY + _yOffset) * scaleMeasurements.scaleY,
													 scaleMeasurements.width);
					if(text.decoration == "underline")
							underline();

			});
			incorporateBoardBounds(text.bounds);
	}

	var renderInks = function(inks,rendered,viewBounds){
			if (inks != undefined){
					_.each(inks,function(ink,i){
							try{
								if (preRenderItem(ink,boardContext)){
									if(intersectRect(ink.bounds,viewBounds)){
											drawInk(ink);
											postRenderItem(ink,boardContext);
											rendered.push(ink);
									}
								}
							}
							catch(e){
									passException(e,"renderInks",[i,ink]);
							}
					});
			}
	};
	var renderRichTexts = function(texts,rendered,viewBounds){
		return;
			if(texts){
					_.each(texts,function(text,i){
						if (preRenderItem(text,boardContext)){
							if(text.doc){
									if(!text.bounds){
											text.doc.invalidateBounds();
									}
									if(intersectRect(text.bounds,viewBounds)){
											drawMultiwordText(text);
											postRenderItem(text,boardContext);
											rendered.push(text);
									}
							}
						}
					});
			}
	};
	var renderVideos = function(videos,rendered,viewBounds){
		return;
			if (videos){
					//Modes.clearCanvasInteractables("videos");
					_.each(videos,function(video,i){
						if (preRenderItem(video,boardContext)){
							if (intersectRect(video.bounds,viewBounds)){
									drawVideo(video);
									//Modes.pushCanvasInteractable("videos",videoControlInteractable(video));
									postRenderItem(video,boardContext);
									rendered.push(video);
							}
						}
					});
			}
	};


	var renderCanvasInteractables = function(canvasContext){
		return;
			_.each(Modes.canvasInteractables,function(category){
					_.each(category,function(interactable){
							if (interactable != undefined && "render" in interactable){
									canvasContext.save();
									canvasContext.lineWidth = 1;
									interactable.render(canvasContext);
									canvasContext.restore();
							}
					});
			});
	};
	var renderTexts = function(texts,rendered,viewBounds){
			_.each(texts,function(text,i){
				if (preRenderItem(text,boardContext)){
					if(intersectRect(text.bounds,viewBounds)){
							drawText(text);
							postRenderItem(text,boardContext);
							rendered.push(text);
					}
				}
			});
	};
	var renderImmediateContent = function(content,rendered,viewBounds){
			renderVideos(content.videos,rendered,viewBounds);
			renderInks(content.highlighters,rendered,viewBounds);
			renderTexts(content.texts,rendered,viewBounds);
			renderRichTexts(content.multiWordTexts,rendered,viewBounds);
			renderInks(content.inks,rendered,viewBounds);
	};

	var proportion = function(width,height){
			var targetWidth = boardWidth;
			var targetHeight = boardHeight;
			return (width / height) / (targetWidth / targetHeight);
	}
	var scaleScreenToWorld = function(i){
			var p = proportion(boardWidth,boardHeight);
			var scale;
			if(p > 1){//Viewbox wider than board
					scale = viewboxWidth / boardWidth;
			}
			else{//Viewbox narrower than board
					scale = viewboxHeight / boardHeight;
			}
			return i * scale;
	}
	var scaleWorldToScreen = function(i){
			var p = proportion(boardWidth,boardHeight);
			var scale;
			if(p > 1){//Viewbox wider than board
					scale = viewboxWidth / boardWidth;
			}
			else{//Viewbox narrower than board
					scale = viewboxHeight / boardHeight;
			}
			return i / scale;
	}

	var screenToWorld = function(x,y){
			var worldX = scaleScreenToWorld(x) + viewboxX;
			var worldY = scaleScreenToWorld(y) + viewboxY;
			return {x:worldX,y:worldY};
	}
	var worldToScreen = function(x,y){
			var screenX = scaleWorldToScreen(x - viewboxX);
			var screenY = scaleWorldToScreen(y - viewboxY);
			return {x:screenX,y:screenY};
	}

	var renderSelectionOutlines = function(canvasContext){
		return;
			var size = Modes.select.resizeHandleSize;
			canvasContext.save();
			canvasContext.lineWidth = 1;
			var multipleItems = [];
			_.forEach(Modes.select.selected,function(category){
					_.forEach(category,function(item){
							var bounds = item.bounds;
							var tl = worldToScreen(bounds[0],bounds[1]);
							var br = worldToScreen(bounds[2],bounds[3]);
							multipleItems.push([tl,br]);
							if(bounds){
									canvasContext.setLineDash([5]);
									canvasContext.strokeStyle = "blue";
									canvasContext.strokeRect(tl.x,tl.y,br.x-tl.x,br.y-tl.y);
							}
					});
			});
			var tb = Modes.select.totalSelectedBounds();
			if(multipleItems.length > 0){
					canvasContext.strokeStyle = "blue";
					canvasContext.strokeWidth = 3;
					canvasContext.strokeRect(tb.tl.x,tb.tl.y,tb.br.x - tb.tl.x,tb.br.y - tb.tl.y);
			}
			canvasContext.restore();
	};
	var renderContentIdentification = function(canvasContext,rendered){
		return;
			canvasContext.save();
			if(Modes.select.isAdministeringContent()){
					var visibleUsers = _.groupBy(rendered,"author");
					var pad = 3;
					_.each(visibleUsers,function(content,user){
							var userBounds = _.reduce(_.map(content,"bounds"),mergeBounds);
							var tl = worldToScreen(userBounds[0],userBounds[1]);
							canvasContext.strokeStyle = "black";
							canvasContext.lineWidth = 0.1;
							_.each(content,function(c){
									canvasContext.beginPath();
									canvasContext.moveTo(tl.x,tl.y);
									var cB = worldToScreen(c.bounds[0],c.bounds[1]);
									canvasContext.lineTo(cB.x,cB.y);
									canvasContext.stroke();
							});
							canvasContext.fillStyle = "black";
							canvasContext.fillRect(tl.x - pad,tl.y,canvasContext.measureText(user).width + pad * 2,14);
							canvasContext.fillStyle = "white";
							canvasContext.fillText(user,tl.x,tl.y+10);
					});
			}
			canvasContext.restore();
	};
	var renderSelectionGhosts = function(canvasContext){
		return;
			var zero = Modes.select.marqueeWorldOrigin;
			if(Modes.select.dragging){
					canvasContext.save();
					var s = scale();
					var x = Modes.select.offset.x - zero.x;
					var y = Modes.select.offset.y - zero.y;
					var screenOffset = worldToScreen(x,y);
					var relativeOffset = worldToScreen(0,0);
					canvasContext.translate(
							screenOffset.x - relativeOffset.x,
							screenOffset.y - relativeOffset.y);
					canvasContext.globalAlpha = 0.7;
					_.forEach(Modes.select.selected,function(category,name){
							_.forEach(category,function(item){
									switch(name){
									case "images":
											drawImage(item);
											break;
									case "videos":
											drawVideo(item);
											break;
									case "texts":
											drawText(item);
											break;
									case "multiWordTexts":
											drawMultiwordText(item);
											break;
									case "inks":
											drawInk(item);
											break;
									}
							});
					});
					canvasContext.restore();
			}
			else if(Modes.select.resizing){
					var totalBounds = Modes.select.totalSelectedBounds();
					var originalWidth = totalBounds.x2 - totalBounds.x;
					var originalHeight = totalBounds.y2 - totalBounds.y;
					var requestedWidth = Modes.select.offset.x - totalBounds.x;
					var requestedHeight = Modes.select.offset.y - totalBounds.y;
					var xScale = requestedWidth / originalWidth;
					var yScale = requestedHeight / originalHeight;
					var transform = function(x,y,func){
							canvasContext.save();
							canvasContext.globalAlpha = 0.7;
							canvasContext.translate(x,y);
							canvasContext.scale(xScale,yScale);
							canvasContext.translate(-x,-y);
							func();
							canvasContext.restore();
					};
					var noop = function(){};
					_.forEach(Modes.select.selected,function(category,name){
							_.forEach(category,function(item){
									var bounds = item.bounds;
									var screenPos = worldToScreen(bounds[0],bounds[1]);
									var x = screenPos.x;
									var y = screenPos.y;
									switch(name){
									case "images":
											transform(x,y,function(){
													drawImage(item);
											});
											break;
									case "videos":
											transform(x,y,function(){
													drawVideo(item);
											});
											break;
									case "texts":
											transform(x,y,function(){
													drawText(item);
											});
											break;
									case "multiWordTexts":
											if(Modes.select.aspectLocked){
													transform(x,y,function(){
															drawMultiwordText(item);
													});
											}
											else{
													canvasContext.save();
													canvasContext.translate(x,y);
													canvasContext.globalAlpha = 0.7;
													var s = scale();
													canvasContext.scale(s,s);
													var scaledText = carota.editor.create({
															querySelector:function(){
																	return {
																			addEventListener:noop
																	}
															},
															handleEvent:noop
													}, canvasContext, noop, _.cloneDeep(item));
													scaledText.position = {x:bounds[0],y:bounds[1]};
													scaledText.load(item.doc.save());
													delete scaledText.canvas;
													var fullRange = scaledText.documentRange();
													var nominatedWidth = Math.max(
															item.doc.width() * xScale,
															Modes.text.minimumWidth / scale()
													);
													scaledText.width(nominatedWidth);
													scaledText.updateCanvas();
													carota.editor.paint(board[0],scaledText);
													canvasContext.restore();
											}
											break;
									case "inks":
											transform(x,y,function(){
													drawInk(item);
											});
											break;
									}
							});
					});
			}
	};

	var renderImages = function(images,rendered,viewBounds){
			_.each(images,function(image,id){
					try{
						if (preRenderItem(image)){
							if(intersectRect(image.bounds,viewBounds)){
									drawImage(image);
									postRenderItem(image,boardContext);
									rendered.push(image);
							}
						}
					}
					catch(e){
						passException(e,"renderImages",[i,image]);
					}
			});
	};

	var pica = function(value){
			return value / 128;
	}
	var unpica = function(value){
			return Math.floor(value * 128);
	}
	var px = function(value){
			return sprintf("%spx",value);
	}
	var unpix = function(str){
			return str.slice(0,str.length-2);
	}
	
	var clearBoard = function(rect){
			try {
					var r = rect == undefined ? {x:0,y:0,w:boardWidth,h:boardHeight} : rect;
					boardContext.clearRect(r.x,r.y,r.w,r.h);
			} catch(e){
				passException(e,"clearBoard",[rect]);
			}
	}
	var isInClearSpace = function(bounds){
			return !_.some(visibleBounds,function(onscreenElement){
					return intersectRect(onscreenElement,bounds);
			});
	};
	var screenBounds = function(worldBounds){
			var screenPos = worldToScreen(worldBounds[0],worldBounds[1]);
			var screenLimit = worldToScreen(worldBounds[2],worldBounds[3]);
			var screenWidth = screenLimit.x - screenPos.x;
			var screenHeight = screenLimit.y - screenPos.y;
			return {
					screenPos:screenPos,
					screenLimit:screenLimit,
					screenWidth:screenWidth,
					screenHeight:screenHeight
			};
	};
	var scaleCanvas = function(incCanvas,w,h){
			if (w >= 1 && h >= 1){
					var canvas = $("<canvas />");
					canvas.width = w;
					canvas.height = h;
					canvas.attr("width",w);
					canvas.attr("height",h);
					canvas.css({
							width:px(w),
							height:px(h)
					});
					var ctx = canvas[0].getContext("2d");
					ctx.drawImage(incCanvas,0,0,w,h);
					return canvas[0];
			} else {
					return incCanvas;
			}
	};

	var mipMappingEnabled = true;
	var multiStageRescale = function(incCanvas,w,h,stanza){
			if (mipMappingEnabled){
					stanza = stanza == undefined ? {} : stanza;
					if (!("mipMap" in stanza)){
							stanza.mipMap = {};
					}
					var mm = stanza.mipMap;
					var sf = 0.5;
					var iw = incCanvas.width;
					var ih = incCanvas.height;
					var save = true;

					var iwSize = Math.floor(iw);
					if (w >= 1 && iw >= 1 && w < iw){ //shrinking
							var sdw = iw * sf;
							var sdh = ih * sf;
							if (sdw < w){
									return incCanvas;
							} else {
									var key = Math.floor(sdw);
									if (!(key in mm)){
											var newCanvas = scaleCanvas(incCanvas,sdw,sdh);
											mm[key] = newCanvas;
									}
									return multiStageRescale(mm[key],w,h,stanza);
							}
					} else {
							return incCanvas;
					}
			} else {
					return incCanvas;
			}
	}

	var drawImage = function(image){
			try{
					if (image.canvas != undefined){
							var sBounds = screenBounds(image.bounds);
							visibleBounds.push(image.bounds);
							if (sBounds.screenHeight >= 1 && sBounds.screenWidth >= 1){
									var borderW = sBounds.screenWidth * 0.10;
									var borderH = sBounds.screenHeight * 0.10;
									boardContext.drawImage(multiStageRescale(image.canvas,sBounds.screenWidth,sBounds.screenHeight,image), sBounds.screenPos.x - (borderW / 2), sBounds.screenPos.y - (borderH / 2), sBounds.screenWidth + borderW ,sBounds.screenHeight + borderH);
							}
					}
			}
			catch(e){
				passException(e,"drawImage",[image]);
			}
	}

	var drawMultiwordText = function(item){
			try {
					if(item.doc && item.doc.canvas){
							var sBounds = screenBounds(item.bounds);
							visibleBounds.push(item.bounds);
							if (sBounds.screenHeight >= 1 && sBounds.screenWidth >= 1){
									boardContext.drawImage(multiStageRescale(item.doc.canvas,sBounds.screenWidth,sBounds.screenHeight,item), sBounds.screenPos.x, sBounds.screenPos.y, sBounds.screenWidth,sBounds.screenHeight);
							}
					}
			}
			catch(e){
				passException(e,"drawMutliwordText",[item]);
			}
	}
	var drawText = function(text){
			try{
					var sBounds = screenBounds(text.bounds);
					visibleBounds.push(text.bounds);
					if (sBounds.screenHeight >= 1 && sBounds.screenWidth >= 1){
							boardContext.drawImage(multiStageRescale(text.canvas,sBounds.screenWidth,sBounds.screenHeight,text),
																			sBounds.screenPos.x,
																			sBounds.screenPos.y,
																			sBounds.screenWidth,
																			sBounds.screenHeight);
					}
			}
			catch(e){
				passException(e,"drawText",[text]);
			}
	}
	var drawInk = function(ink){
			var sBounds = screenBounds(ink.bounds);
			visibleBounds.push(ink.bounds);
			var c = ink.canvas;
			if(!c){
					c = ink.canvas = prerenderInk(ink);
			}
			var cWidth = c.width;
			var cHeight = c.height;
			if (sBounds.screenHeight >= 1 && sBounds.screenWidth >= 1){
					var img = multiStageRescale(c,sBounds.screenWidth,sBounds.screenHeight,ink);
					if(img){
						try{
								var inset = ink.thickness / 2;
								var sW = img.width;
								var sH = img.height;
								var xFactor = img.width / cWidth;
								var yFactor = img.height / cHeight;
								var iX = inset * xFactor;
								var iY = inset * yFactor;

								var tX = sBounds.screenPos.x - iX;
								var tY = sBounds.screenPos.y - iY;
								var tW = sBounds.screenWidth + (2 * iX);
								var tH = sBounds.screenHeight + (2 * iY);
								boardContext.drawImage(img,
																				0, 0,
																				sW, sH,
																				tX,tY,
																				tW,tH);
						}
						catch(e){
							passException(e,"drawInk",[ink,img]);
						}
					} else {
						c = ink.canvas = prerenderInk(ink,incCanvasContext);
						img = multiStageRescale(c,sBounds.screenWidth,sBounds.screenHeight,ink);
					}
			}
	}
	var drawVideo = function(video){
			var sBounds = screenBounds(video.bounds);
			visibleBounds.push(video.bounds);
			if (sBounds.screenHeight >= 1 && sBounds.screenWidth >= 1){
					boardContext.drawImage(video.video,
																	sBounds.screenPos.x,sBounds.screenPos.y,
																	sBounds.screenWidth,sBounds.screenHeight);
			}
	}

	var measureBoardContent = function(includingText){
			if(includingText){
					_.each(boardContent.multiWordTexts,function(t){
							t.doc.invalidateBounds();
					});
			}
			var content = _.flatMap([boardContent.multiWordTexts,boardContent.inks,boardContent.images,boardContent.videos],_.values);
			if(content.length == 0){
					boardContent.height = boardHeight;
					boardContent.width = boardWidth;
			}
			else{
					var bs = _.map(content,"bounds")
					bs.push([0,0,0,0]);/*Ensure origin is included*/
					var bounds = _.reduce(bs,mergeBounds);
					boardContent.width = bounds.width;
					boardContent.height = bounds.height;
					boardContent.minX = bounds.minX;
					boardContent.minY = bounds.minY;
			}
	}

	var render = function(){
		var renderStart = new Date().getTime();
		try {
			if (boardContent !== undefined){
				var content = boardContent;
				clearBoard({x:0,y:0,w:boardWidth,h:boardHeight});
				canvasElem.width(boardWidth);
				canvasElem.height(boardHeight);	
				canvasElem.attr("width",boardWidth);
				canvasElem.attr("height",boardHeight);	
				canvasElem[0].width = boardWidth;
				canvasElem[0].height = boardHeight;	
				renderStarting(boardContext,canvasElem,boardContent);
				if(content){
					try{
						visibleBounds = [];
						var rendered = [];
						var viewBounds = [viewboxX,viewboxY,viewboxX + viewboxWidth,viewboxY + viewboxHeight];//[boardContent.minX,boardContent.minY,boardContent.maxX,boardContent.maxY];
						renderImages(content.images,rendered,viewBounds);
						renderImmediateContent(content,rendered,viewBounds);
						/*
						renderSelectionOutlines();
						renderSelectionGhosts();
						renderContentIdentification(rendered);
						renderCanvasInteractables();
						renderTint({x:0,y:0,w:boardWidth,h:boardHeight});
						*/
						statistic("render",new Date().getTime() - renderStart,true);
					}
					catch(e){
						passException(e,"renderWithContent",[content]);
						statistic("render",new Date().getTime() - renderStart,false,e);
					}
				}
				renderComplete(boardContext,canvasElem,boardContent);
			}
		} catch(e){
			passException(e,"render",[]);
			statistic("render",new Date().getTime() - renderStart,false,e);
		}
	}
	var blit = function(content){
		render();
	};

	var preRenderHistory = function(history,afterFunc){
		var start = new Date().getTime();
		try {
			history.multiWordTexts = _.pickBy(history.multiWordTexts,isUsable);
			history.texts = _.pickBy(history.texts,isUsable);
			history.images = _.pickBy(history.images,isUsable);
			history.inks = _.pickBy(history.inks,isUsable);

			boardContent = history;
			boardContent.minX = 0;
			boardContent.minY = 0;
			boardContent.maxX = boardWidth;
			boardContent.maxY = boardHeight;

			_.forEach(boardContent.inks,function(ink,i){
				prerenderInk(ink,true);
			});
			_.forEach(boardContent.highlighters,function(ink,i){
				prerenderInk(ink,true);
			});
			_.forEach(boardContent.multiWordTexts,function(text,i){
				prerenderMultiWordText(text,true);
			});
			_.forEach(boardContent.texts,function(text,i){
				prerenderText(text,true);
			});
			_.forEach(boardContent.images,function(image,i){
				prerenderImage(image,true);
			});
			_.forEach(boardContent.videos,function(video,i){
				prerenderVideo(video,true);
			});
			boardContent.width = boardContent.maxX - boardContent.minX;
			boardContent.height = boardContent.maxY - boardContent.minY;

			viewboxWidth = boardContent.maxX - boardContent.minX;
			viewboxHeight = boardContent.maxY - boardContent.minY;

			var startRender = function(){
				if (boardContent.minX == Infinity){
					boardContent.minX = 0;
				}
				if (boardContent.minY == Infinity){
					boardContent.minY = 0;
				} 
				statistic("preRenderHistory",new Date().getTime() - start,true);
				if (afterFunc !== undefined){
					afterFunc();
				}
			}
			if (_.size(boardContent.images) == 0){
				startRender();
			} else {
				var loaded = 0;
				var limit = _.size(boardContent.images);
				_.forEach(boardContent.images,function(image){
					image.bounds = [image.x,image.y,image.x+image.width,image.y+image.height];
					incorporateBoardBounds(image.bounds);
					var dataImage = new Image();
					image.imageData = dataImage;
					var url = calculateImageSource(image,true);
					dataImage.onload = function(data){
						var shouldReCalcBounds = false;
						if (image.width == 0){
							image.width = dataImage.naturalWidth;
							shouldReCalcBounds = true;
						}
						if (image.height == 0){
							image.height = dataImage.naturalHeight;
							shouldReCalcBounds = true;
						}
						if (shouldReCalcBounds){
							image.bounds = [image.x,image.y,image.x+image.width,image.y+image.height];
							incorporateBoardBounds(image.bounds);
						}
						prerenderImage(image);
						limit -= 1;
						if (loaded >= limit){
							_.defer(startRender);
						}
					};
					dataImage.onError = function(error){
						passException(error,"preRenderHistory:imageDataLoad",[dataImage,image]);
						limit -= 1;
						if (loaded >= limit){
							_.defer(startRender);
						}
					};
					dataImage.src = url;
				});
			}
		} catch(e){
			statistic("preRenderHistory",new Date().getTime() - start,false,e);
		}
	};

	var renderFunc = function(){
		blit();
	};
	var receiveHistoryFunc = function(history){
		historyReceived(history);
		preRenderHistory(history,blit);
	};
	var passException = function(e,loc,params){ };
	var renderStarting = function(ctx,elem,history){ };
	var renderComplete = function(ctx,elem,history){ };
	var viewboxChanged = function(vb,ctx,elem){ };
	var dimensionsChanged = function(dims,ctx,elem){ };
	var scaleChanged = function(scale,ctx,elem){ };
	var historyReceived = function(history){ };
	var historyUpdated = function(history){ };
	var statistic = function(category,time,success,exception){ };
	var preRenderItem = function(item,ctx){
		return true;
	};
	var postRenderItem = function(item,ctx){ };
	var setDimensionsFunc = function(dims){
		if (dims !== undefined && "width" in dims && "height" in dims){
			if (dims.width !== boardWidth || dims.height != boardHeight){
				boardWidth = dims.width;
				boardHeight = dims.height;
			};
			blit();
		}
	};
	return {
		setHistory:receiveHistoryFunc,
		addStanza:addStanzaFunc,	
		render:renderFunc,
		getBoardContent:function(){return boardContent;},
		getBoardContext:function(){return boardContext;},
		screenToWorld:screenToWorld,
		worldToScreen:worldToScreen,
		scaleWorldToScreen:scaleWorldToScreen,
		scaleScreenToWorld:scaleScreenToWorld,
		getViewbox:function(){
			return {
				width:viewboxWidth,
				height:viewboxHeight,
				x:viewboxX,
				y:viewboxY
			};
		},
		getDimensions:function(){
			return {
				width:boardWidth,
				height:boardHeight
			};
		},
		setDimensions:setDimensionsFunc,
		getScale:function(){
			return scale();
		},
		setViewbox:function(x,y,w,h){
			viewboxX = x;
			viewboxY = y;
			viewboxWidth = w;
			viewboxHeight = h;
			viewboxChanged({
				width:viewboxWidth,
				height:viewboxHeight,
				x:viewboxX,
				y:viewboxY
			});
		},
		onHistoryChanged:function(f){
			historyReceived = f;
		},
		onHistoryUpdated:function(f){
			historyUpdated = f;
		},
		onException:function(f){
			passException = f;
		},
		onRenderStarting:function(f){
			renderStarting = f;
		},
		onStatistic:function(f){
			statistic = f;
		},
		onRenderComplete:function(f){
			renderComplete = f;
		},
		onViewboxChanged:function(f){
			viewboxChanged = f;
		},
		onDimensionsChanged:function(f){
			dimensionsChanged = f;
		},
		onScaleChanged:function(f){
			scaleChanged = f;
		},
		onPreRenderItem:function(f){
			preRenderItem = f;
		},
		onPostRenderItem:function(f){
			postRenderItem = f
		},	
		getDataURI:function(){
			return canvasElem[0].toDataURL();
		}
	};
};