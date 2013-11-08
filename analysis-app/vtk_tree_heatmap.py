"""An example of a VTKWeb script for use with Tangelo's VTKWeb capabilities.

The add_arguments() function takes an argparse.ArgumentParser object, to which
the author may add possible command line flags, etc.

The initialize() function will be invoked by the VTKWeb framework in the
Protocol class's own initialize() method.  The VTK application logic goes here."""

# VTKWeb currently doesn't search this script's path for other
# modules.  IMO this should be fixed, but here's a workaround
import os.path, sys
sys.path.append(os.path.dirname(os.path.realpath(__file__)))

import vtk
import vtk_arbor_utils
import math
import csv
import pymongo
import json
import bson.objectid
import bson.json_util
import requests

def add_arguments(parser):
    parser.add_argument("--baseURL", help="protocol:host", dest="baseURL")
    parser.add_argument("--projectName", help="name of current project", dest="projectName")
    parser.add_argument("--tableName", help="name of character matrix in Mongo", dest="tableName")
    parser.add_argument("--treeName", help="name of phylotree in Mongo", dest="treeName")

def initialize(self, VTKWebApp, args):
    # Create default pipeline (Only once for all the session)
    if not VTKWebApp.view:

        # get the input data in newick & csv format
        r = requests.get(
          "%s/arborapi/projmgr/project/%s/PhyloTree/%s/newick" % (args.baseURL, args.projectName, args.treeName))
        newickTree = r.text
        r = requests.get(
          "%s/arborapi/projmgr/project/%s/CharacterMatrix/%s/csv" % (args.baseURL, args.projectName, args.tableName))
        csvTable = r.text

        # read these into VTK format
        tree = vtk_arbor_utils.NewickToVTKTree(newickTree)
        table = vtk_arbor_utils.CSVToVTKTable(csvTable)

        # create our visualization item
        treeHeatmapItem = vtk.vtkTreeHeatmapItem()
        treeHeatmapItem.SetTree(tree)
        treeHeatmapItem.SetTable(table)

        # setup the window
        view = vtk.vtkContextView()
        view.GetRenderer().SetBackground(1,1,1)
        view.GetRenderWindow().SetSize(800,600)

        iren = view.GetInteractor()
        iren.SetRenderWindow(view.GetRenderWindow())

        transformItem = vtk.vtkContextTransform()
        transformItem.AddItem(treeHeatmapItem)
        transformItem.SetInteractive(1)

        view.GetScene().AddItem(transformItem)
        view.GetRenderWindow().SetMultiSamples(0)

        iren.Initialize()
        view.GetRenderWindow().Render()

        # adjust zoom so the item nicely fills the screen
        itemSize = [0, 0]
        treeHeatmapItem.GetSize(itemSize)

        itemSize.append(0)
        transformItem.GetTransform().MultiplyPoint(itemSize, itemSize)

        newWidth = view.GetScene().GetSceneWidth()
        newHeight = view.GetScene().GetSceneHeight()

        pageWidth = newWidth
        pageHeight = newHeight
        sx = pageWidth  / itemSize[0]
        sy = pageHeight / itemSize[1]
        if sy < sx:
           scale = sy;
        else:
           scale = sx;

        if scale > 1:
           scale = scale * 0.5
        else:
           scale = scale * 0.9

        transformItem.Scale(scale, scale)

        # center the item within the screen
        itemCenter = [0, 0]
        treeHeatmapItem.GetCenter(itemCenter)
        itemCenter.append(0)

        centerPt = vtk.vtkPoints2D()
        centerPt.InsertNextPoint(newWidth / 2.0, newHeight / 2.0)
        transformItem.GetTransform().InverseTransformPoints(centerPt, centerPt)
        sceneCenter = [0, 0]
        centerPt.GetPoint(0, sceneCenter)

        dx = -1 * (itemCenter[0] - sceneCenter[0])
        dy = -1 * (itemCenter[1] - sceneCenter[1])

        transformItem.Translate(dx, dy)

        # VTK Web application specific
        VTKWebApp.view = view.GetRenderWindow()
        self.Application.GetObjectIdMap().SetActiveObject("VIEW", view.GetRenderWindow())

